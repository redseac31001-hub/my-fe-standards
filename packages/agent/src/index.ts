#!/usr/bin/env node

/**
 * Ralph Agent - 基于 Claude Agent SDK 的自主编码代理
 *
 * 将 PRD 分解为用户故事，通过迭代执行完成实现。
 * 每次迭代调用一个 Claude Code 子进程处理一个故事。
 */

import { claude } from '@anthropic-ai/claude-code'
import * as fs from 'fs/promises'
import * as path from 'path'

// 类型定义
interface UserStory {
  id: string
  title: string
  description: string
  acceptanceCriteria: string[]
  priority: number
  passes: boolean
  notes: string
}

interface PrdConfig {
  project: string
  branchName: string
  description: string
  userStories: UserStory[]
}

interface RalphOptions {
  workDir: string
  maxIterations: number
}

// Ralph 提示模板
const RALPH_SYSTEM_PROMPT = `你是 Ralph，一个自主编码代理。

## 你的任务

1. 读取 prd.json 获取任务定义
2. 读取 progress.txt 中的 Codebase Patterns 部分
3. 确保在正确的分支上
4. 实现指定的用户故事
5. 运行质量检查（typecheck、lint、test）
6. 提交代码：feat: [Story ID] - [Story Title]
7. 更新 prd.json 设置 passes: true
8. 追加进度到 progress.txt

## 质量要求

- 所有提交必须通过 typecheck
- 遵循项目现有代码模式
- 保持最小化改动

## 进度报告格式

APPEND to progress.txt:
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
---
`

// 辅助函数
async function readPrd(workDir: string): Promise<PrdConfig | null> {
  try {
    const content = await fs.readFile(path.join(workDir, 'prd.json'), 'utf-8')
    return JSON.parse(content) as PrdConfig
  } catch {
    return null
  }
}

function getNextStory(prd: PrdConfig): UserStory | null {
  return (
    prd.userStories
      .filter((s) => !s.passes)
      .sort((a, b) => a.priority - b.priority)[0] || null
  )
}

function isAllComplete(prd: PrdConfig): boolean {
  return prd.userStories.every((s) => s.passes)
}

// 执行单次迭代
async function runIteration(
  story: UserStory,
  prd: PrdConfig,
  options: RalphOptions,
  iterationNumber: number,
  maxIterations: number
): Promise<boolean> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  Ralph 迭代 ${iterationNumber}/${maxIterations}`)
  console.log(`  故事: ${story.id} - ${story.title}`)
  console.log(`${'='.repeat(60)}\n`)

  const prompt = `
${RALPH_SYSTEM_PROMPT}

## 当前任务

实现以下用户故事：

**${story.id}: ${story.title}**
- 描述: ${story.description}
- 验收标准:
${story.acceptanceCriteria.map((c) => `  - ${c}`).join('\n')}

项目: ${prd.project}
分支: ${prd.branchName}

请开始实现这个故事。完成后更新 prd.json 并记录进度。

如果所有故事都已完成，输出：<promise>COMPLETE</promise>
`

  try {
    // 调用 Claude Code SDK
    const result = await claude({
      prompt,
      options: {
        cwd: options.workDir,
        allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
      },
    })

    // 检查输出中是否包含完成信号
    const output = typeof result === 'string' ? result : JSON.stringify(result)
    if (output.includes('<promise>COMPLETE</promise>')) {
      console.log('\n🎉 Ralph 已完成所有任务！')
      return true
    }

    return false
  } catch (error) {
    console.error(`\n❌ 迭代 ${iterationNumber} 失败:`, error)
    return false
  }
}

// 主函数
async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2)
  const options: RalphOptions = {
    workDir: process.cwd(),
    maxIterations: 10,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--workdir':
      case '-d':
        options.workDir = args[++i]
        break
      case '--max-iterations':
      case '-n':
        options.maxIterations = parseInt(args[++i], 10)
        break
      case '--help':
      case '-h':
        console.log(`
Ralph Agent - 自主编码代理

用法: ralph-agent [选项]

选项:
  -d, --workdir <path>        工作目录（默认：当前目录）
  -n, --max-iterations <num>  最大迭代次数（默认：10）
  -h, --help                  显示帮助信息
`)
        process.exit(0)
    }
  }

  console.log(`🚀 Ralph Agent 启动`)
  console.log(`   工作目录: ${options.workDir}`)
  console.log(`   最大迭代: ${options.maxIterations}`)

  // 读取 PRD
  const prd = await readPrd(options.workDir)
  if (!prd) {
    console.error('❌ 未找到 prd.json，请先创建任务定义')
    process.exit(1)
  }

  console.log(`   项目: ${prd.project}`)
  console.log(`   分支: ${prd.branchName}`)
  console.log(
    `   故事: ${prd.userStories.filter((s) => s.passes).length}/${prd.userStories.length} 已完成`
  )

  // 迭代执行
  for (let i = 1; i <= options.maxIterations; i++) {
    // 每次迭代重新读取 PRD（可能已被上次迭代更新）
    const currentPrd = await readPrd(options.workDir)
    if (!currentPrd) {
      console.error('❌ prd.json 在迭代中丢失')
      process.exit(1)
    }

    // 检查是否已全部完成
    if (isAllComplete(currentPrd)) {
      console.log('\n🎉 所有故事已完成！')
      process.exit(0)
    }

    // 获取下一个故事
    const nextStory = getNextStory(currentPrd)
    if (!nextStory) {
      console.log('\n🎉 没有待执行的故事')
      process.exit(0)
    }

    // 执行迭代
    const completed = await runIteration(nextStory, currentPrd, options, i, options.maxIterations)
    if (completed) {
      process.exit(0)
    }

    // 短暂等待
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  console.log(`\n⚠️ 达到最大迭代次数 (${options.maxIterations})，未完成所有任务`)
  process.exit(1)
}

main().catch((error) => {
  console.error('Ralph Agent 异常退出:', error)
  process.exit(1)
})

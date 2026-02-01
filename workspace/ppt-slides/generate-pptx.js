const pptxgen = require('pptxgenjs');
const path = require('path');

// 获取 html2pptx 库路径
const html2pptxPath = path.join(
  'C:\\Users\\wozhifu\\.claude\\plugins\\cache\\anthropic-agent-skills\\example-skills\\unknown\\skills\\pptx\\scripts',
  'html2pptx.js'
);
const html2pptx = require(html2pptxPath);

const slidesDir = 'E:\\mygit\\my-fe-standards\\workspace\\ppt-slides';
const outputPath = 'E:\\mygit\\my-fe-standards\\workspace\\my-fe-standards-presentation.pptx';

// 幻灯片文件列表（按顺序）
const slideFiles = [
  'slide01-cover.html',
  'slide02-pain-points.html',
  'slide03-solution.html',
  'slide04-stats.html',
  'slide05-architecture.html',
  'slide06-three-layers.html',
  'slide07-tech-detect.html',
  'slide08-loading-strategy.html',
  'slide09-manifest.html',
  'slide10-rules-overview.html',
  'slide11-layer1.html',
  'slide12-layer2.html',
  'slide13-layer3.html',
  'slide14-skills.html',
  'slide15-agents.html',
  'slide16-task-orchestrator.html',
  'slide17-agent-collab.html',
  'slide18-memory-overview.html',
  'slide19-health-timeline.html',
  'slide20-diff-compare.html',
  'slide21-deploy.html',
  'slide22-loader-output.html',
  'slide23-code-review.html',
  'slide24-task-demo.html',
  'slide25-core-values.html',
  'slide26-highlights.html',
  'slide27-roadmap.html',
  'slide28-qa.html'
];

async function createPresentation() {
  const pptx = new pptxgen();

  // 设置演示文稿属性
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = 'my-fe-standards - AI 辅助开发平台';
  pptx.author = 'my-fe-standards Team';
  pptx.subject = '项目功能与实现介绍';

  console.log('开始生成 PowerPoint 演示文稿...');
  console.log(`共 ${slideFiles.length} 页幻灯片`);

  // 逐个处理幻灯片
  for (let i = 0; i < slideFiles.length; i++) {
    const slideFile = slideFiles[i];
    const slidePath = path.join(slidesDir, slideFile);

    console.log(`处理第 ${i + 1}/${slideFiles.length} 页: ${slideFile}`);

    try {
      await html2pptx(slidePath, pptx);
    } catch (error) {
      console.error(`处理 ${slideFile} 时出错:`, error.message);
      // 继续处理下一个幻灯片
    }
  }

  // 保存演示文稿
  console.log('保存演示文稿...');
  await pptx.writeFile({ fileName: outputPath });
  console.log(`演示文稿已保存到: ${outputPath}`);
}

createPresentation().catch(error => {
  console.error('生成演示文稿失败:', error);
  process.exit(1);
});

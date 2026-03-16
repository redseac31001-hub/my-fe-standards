import * as fs from 'fs';
import * as path from 'path';
import {
  PackageJson,
  ProjectKind,
  ProjectLang,
  SubProject,
  VueProfile,
  WorkspaceInfo,
  WorkspaceScope,
} from '../types';
import { Logger } from './logger';

export interface DetectedProjectMetadata {
  frameworkLabel: string;
  uiLibLabels: string[];
  projectKind: ProjectKind;
  stackTags: string[];
}

interface ProjectMarker {
  files: string[];
  lang: ProjectLang;
  refinements?: Array<{ files: string[]; lang: ProjectLang }>;
}

const WORKSPACE_EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', 'build', '.codebuddy', '.git',
  'coverage', '.next', '.nuxt', '.output', '.cache',
]);

const MAX_SUB_PROJECTS = 20;

const PROJECT_MARKERS: ProjectMarker[] = [
  {
    files: ['package.json'],
    lang: 'javascript',
    refinements: [
      { files: ['tsconfig.json'], lang: 'typescript' },
    ],
  },
  { files: ['pom.xml'], lang: 'java' },
  { files: ['build.gradle', 'build.gradle.kts'], lang: 'java' },
  { files: ['go.mod'], lang: 'go' },
  { files: ['pyproject.toml', 'setup.py'], lang: 'python' },
  { files: ['Cargo.toml'], lang: 'rust' },
];

const KNOWN_UI_LIBS: Record<string, string> = {
  'ant-design-vue': 'Ant Design Vue',
  'vant': 'Vant',
  'element-plus': 'Element Plus',
  'element-ui': 'Element UI',
  'naive-ui': 'Naive UI',
  'vuetify': 'Vuetify',
  '@arco-design/web-vue': 'Arco Design Vue',
  'antd': 'Ant Design',
  '@mui/material': 'MUI',
};

const NODE_BACKEND_STRONG_ENTRY_FILES = [
  'src/server.ts',
  'src/server.js',
  'src/server.mjs',
  'src/server.cjs',
  'server.ts',
  'server.js',
  'server.mjs',
  'server.cjs',
];

const NODE_BACKEND_WEAK_ENTRY_FILES = [
  'src/main.ts',
  'src/main.js',
  'src/app.ts',
  'src/app.js',
  'main.ts',
  'main.js',
  'app.ts',
  'app.js',
  'index.ts',
  'index.js',
];

const NODE_BACKEND_LAYOUT_DIRS = [
  'src/routes',
  'src/controllers',
  'src/middleware',
  'src/handlers',
  'src/api',
  'routes',
  'controllers',
  'middleware',
  'handlers',
  'api',
];

export function checkVueProfile(dependencies: Record<string, string>): VueProfile | null {
  const vueVersion = dependencies.vue;
  if (!vueVersion) return null;

  if (vueVersion.startsWith('3') || vueVersion.startsWith('^3') || vueVersion.startsWith('~3')) {
    return { version: 3, type: 'standard' };
  }

  if (vueVersion.startsWith('2') || vueVersion.startsWith('^2') || vueVersion.startsWith('~2')) {
    if (dependencies['@vue/composition-api']) {
      return { version: 2, type: 'composition' };
    }
    return { version: 2, type: 'options' };
  }

  return null;
}

export function normalizeStackTag(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function normalizeStackLabel(value: string): string {
  return normalizeStackTag(value);
}

function normalizeSelector(value: string): string {
  return value.trim().toLowerCase().replace(/\\/g, '/');
}

function finalizeStackTags(values: Iterable<string>): string[] {
  return [...new Set([...values].map(normalizeStackTag).filter(Boolean))].sort();
}

function readProjectFileIfExists(filePath: string): string {
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  } catch {
    return '';
  }
}

function detectUILibs(deps: Record<string, string>): string[] {
  const result: string[] = [];
  for (const [pkg, label] of Object.entries(KNOWN_UI_LIBS)) {
    if (deps[pkg]) {
      result.push(label);
    }
  }
  return result;
}

function detectNodePackageManagers(projectDir: string): string[] {
  const markers: Array<{ file: string; tag: string }> = [
    { file: 'pnpm-lock.yaml', tag: 'pnpm' },
    { file: 'yarn.lock', tag: 'yarn' },
    { file: 'package-lock.json', tag: 'npm' },
    { file: 'bun.lockb', tag: 'bun' },
    { file: 'bun.lock', tag: 'bun' },
  ];

  return markers
    .filter(marker => fs.existsSync(path.join(projectDir, marker.file)))
    .map(marker => marker.tag);
}

function detectGenericNodeBackendProject(projectDir: string, packageJson: PackageJson): boolean {
  const scripts = packageJson.scripts || {};
  const scriptValues = Object.values(scripts).filter((value): value is string => typeof value === 'string');
  const hasBackendScript = scriptValues.some(command =>
    /(node|nodemon|tsx|ts-node|ts-node-dev|bun|pm2)/i.test(command)
    && /(server|api|listen|http)/i.test(command)
  );

  for (const relativePath of NODE_BACKEND_STRONG_ENTRY_FILES) {
    if (fs.existsSync(path.join(projectDir, relativePath))) {
      return true;
    }
  }

  for (const relativePath of NODE_BACKEND_WEAK_ENTRY_FILES) {
    const absolutePath = path.join(projectDir, relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const content = readProjectFileIfExists(absolutePath);
    if (/(createServer|listen\s*\(|process\.env\.PORT|IncomingMessage|ServerResponse)/.test(content)) {
      return true;
    }
  }

  const layoutClues = NODE_BACKEND_LAYOUT_DIRS.filter(relativePath =>
    fs.existsSync(path.join(projectDir, relativePath))
  ).length;

  if (layoutClues >= 2) {
    return true;
  }

  return hasBackendScript && layoutClues >= 1;
}

function detectJavaProjectMetadata(projectDir: string): DetectedProjectMetadata {
  const pomContent = readProjectFileIfExists(path.join(projectDir, 'pom.xml'));
  const gradleContent =
    readProjectFileIfExists(path.join(projectDir, 'build.gradle'))
    || readProjectFileIfExists(path.join(projectDir, 'build.gradle.kts'));
  const combinedContent = `${pomContent}\n${gradleContent}`.toLowerCase();

  const stackTags = new Set<string>(['java']);
  if (pomContent) stackTags.add('maven');
  if (gradleContent) stackTags.add('gradle');

  let frameworkLabel = '';
  let projectKind: ProjectKind = 'library';

  if (/org\.springframework\.boot|spring-boot/.test(combinedContent)) {
    frameworkLabel = 'Spring Boot';
    projectKind = 'backend';
    stackTags.add('springboot');
    stackTags.add('spring');
  } else if (/io\.quarkus|quarkus/.test(combinedContent)) {
    frameworkLabel = 'Quarkus';
    projectKind = 'backend';
    stackTags.add('quarkus');
  } else if (/io\.micronaut|micronaut/.test(combinedContent)) {
    frameworkLabel = 'Micronaut';
    projectKind = 'backend';
    stackTags.add('micronaut');
  } else if (/jakarta\.ws\.rs|javax\.ws\.rs/.test(combinedContent)) {
    frameworkLabel = 'Jakarta REST';
    projectKind = 'backend';
    stackTags.add('jakartarest');
  }

  if (/spring-data-jpa|starter-data-jpa|hibernate-core|jakarta\.persistence|javax\.persistence/.test(combinedContent)) {
    stackTags.add('jpa');
  }
  if (/mybatis/.test(combinedContent)) {
    stackTags.add('mybatis');
  }

  return {
    frameworkLabel,
    uiLibLabels: [],
    projectKind,
    stackTags: finalizeStackTags(stackTags),
  };
}

function detectRustProjectMetadata(projectDir: string): DetectedProjectMetadata {
  const cargoContent = readProjectFileIfExists(path.join(projectDir, 'Cargo.toml'));
  const normalizedContent = cargoContent.toLowerCase();
  const stackTags = new Set<string>(['rust', 'cargo']);

  let frameworkLabel = '';
  let projectKind: ProjectKind = 'library';

  if (/\baxum\b/.test(normalizedContent)) {
    frameworkLabel = 'Axum';
    projectKind = 'backend';
    stackTags.add('axum');
  } else if (/actix-web/.test(normalizedContent)) {
    frameworkLabel = 'Actix Web';
    projectKind = 'backend';
    stackTags.add('actixweb');
  } else if (/\brocket\b/.test(normalizedContent)) {
    frameworkLabel = 'Rocket';
    projectKind = 'backend';
    stackTags.add('rocket');
  } else if (/\btonic\b/.test(normalizedContent)) {
    frameworkLabel = 'Tonic';
    projectKind = 'backend';
    stackTags.add('tonic');
  }

  if (/\btokio\b/.test(normalizedContent)) stackTags.add('tokio');
  if (/\bserde\b/.test(normalizedContent)) stackTags.add('serde');
  if (/^\s*\[workspace\]/m.test(cargoContent)) stackTags.add('cargoworkspace');

  return {
    frameworkLabel,
    uiLibLabels: [],
    projectKind,
    stackTags: finalizeStackTags(stackTags),
  };
}

function detectDotnetProjectMetadata(projectDir: string): DetectedProjectMetadata {
  const projectFiles = fs.readdirSync(projectDir)
    .filter(entry => entry.endsWith('.csproj') || entry.endsWith('.fsproj'));
  const combinedContent = projectFiles
    .map(file => readProjectFileIfExists(path.join(projectDir, file)))
    .join('\n')
    .toLowerCase();

  const stackTags = new Set<string>(['dotnet']);
  let frameworkLabel = '';
  let projectKind: ProjectKind = 'library';

  if (/microsoft\.aspnetcore|aspnetcore/.test(combinedContent)) {
    frameworkLabel = 'ASP.NET Core';
    projectKind = 'backend';
    stackTags.add('aspnetcore');
  } else if (/microsoft\.aspnetcore\.components|blazor/.test(combinedContent)) {
    frameworkLabel = 'Blazor';
    projectKind = 'frontend';
    stackTags.add('blazor');
  }

  return {
    frameworkLabel,
    uiLibLabels: [],
    projectKind,
    stackTags: finalizeStackTags(stackTags),
  };
}

function detectGenericProjectMetadata(lang: ProjectLang): DetectedProjectMetadata {
  return {
    frameworkLabel: '',
    uiLibLabels: [],
    projectKind: 'unknown',
    stackTags: finalizeStackTags([lang]),
  };
}

function detectNodeProjectMetadata(projectDir: string, packageJson: PackageJson, lang: ProjectLang): {
  dependencies: Record<string, string>;
  vueProfile: VueProfile | null;
} & DetectedProjectMetadata {
  const dependencies: Record<string, string> = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  const vueProfile = checkVueProfile(dependencies);
  const uiLibLabels = detectUILibs(dependencies);
  const stackTags = new Set<string>([lang, 'nodejs', ...detectNodePackageManagers(projectDir)]);
  const detectedKinds = new Set<ProjectKind>();
  let frameworkLabel = '';

  const markFramework = (label: string, kind: ProjectKind, ...tags: string[]): void => {
    if (!frameworkLabel) frameworkLabel = label;
    detectedKinds.add(kind);
    for (const tag of tags) stackTags.add(tag);
  };

  if (packageJson.type === 'module') stackTags.add('esm');
  if (packageJson.workspaces) stackTags.add('monorepo');
  if (dependencies.vite) stackTags.add('vite');
  if (dependencies.webpack) stackTags.add('webpack');

  if (dependencies.next) markFramework('Next.js', 'fullstack', 'nextjs');
  if (dependencies.nuxt || dependencies.nuxt3) markFramework(frameworkLabel || 'Nuxt', 'fullstack', 'nuxt');
  if (dependencies['@remix-run/node'] || dependencies['@remix-run/react']) {
    markFramework(frameworkLabel || 'Remix', 'fullstack', 'remix');
  }

  if (dependencies['@nestjs/core']) markFramework(frameworkLabel || 'NestJS', 'backend', 'nestjs');
  if (dependencies.express) markFramework(frameworkLabel || 'Express', 'backend', 'express');
  if (dependencies.fastify) markFramework(frameworkLabel || 'Fastify', 'backend', 'fastify');
  if (dependencies.koa) markFramework(frameworkLabel || 'Koa', 'backend', 'koa');
  if (dependencies.hono) markFramework(frameworkLabel || 'Hono', 'backend', 'hono');

  if (dependencies.vue) {
    const vueTags = vueProfile?.version === 3
      ? ['vue', 'vue3']
      : vueProfile?.version === 2
        ? ['vue', 'vue2']
        : ['vue'];
    markFramework(frameworkLabel || (vueProfile?.version === 3 ? 'Vue 3' : vueProfile?.version === 2 ? 'Vue 2' : 'Vue'), 'frontend', ...vueTags);
  }
  if (dependencies.react) markFramework(frameworkLabel || 'React', 'frontend', 'react');
  if (dependencies['@angular/core']) markFramework(frameworkLabel || 'Angular', 'frontend', 'angular');
  if (dependencies.svelte) markFramework(frameworkLabel || 'Svelte', 'frontend', 'svelte');

  if (!detectedKinds.has('backend') && !detectedKinds.has('frontend') && detectGenericNodeBackendProject(projectDir, packageJson)) {
    markFramework(frameworkLabel || 'Node Service', 'backend', 'nodeservice');
  }

  for (const uiLibLabel of uiLibLabels) {
    stackTags.add(uiLibLabel);
  }

  let projectKind: ProjectKind = 'library';
  if (detectedKinds.has('fullstack') || (detectedKinds.has('frontend') && detectedKinds.has('backend'))) {
    projectKind = 'fullstack';
  } else if (detectedKinds.has('backend')) {
    projectKind = 'backend';
  } else if (detectedKinds.has('frontend')) {
    projectKind = 'frontend';
  }

  return {
    dependencies,
    vueProfile,
    frameworkLabel,
    uiLibLabels,
    projectKind,
    stackTags: finalizeStackTags(stackTags),
  };
}

export function detectProjectMetadata(projectDir: string, lang: ProjectLang, packageJson?: PackageJson): {
  dependencies: Record<string, string>;
  vueProfile: VueProfile | null;
} & DetectedProjectMetadata {
  if (packageJson) {
    return detectNodeProjectMetadata(projectDir, packageJson, lang);
  }

  const metadata = (() => {
    switch (lang) {
      case 'java':
        return detectJavaProjectMetadata(projectDir);
      case 'rust':
        return detectRustProjectMetadata(projectDir);
      case 'dotnet':
        return detectDotnetProjectMetadata(projectDir);
      default:
        return detectGenericProjectMetadata(lang);
    }
  })();

  return {
    dependencies: {},
    vueProfile: null,
    ...metadata,
  };
}

export function discoverWorkspace(logger: Logger, targetDir: string): WorkspaceInfo {
  const projects: SubProject[] = [];
  const visited = new Set<string>();

  function scan(dir: string, depth: number): void {
    if (depth > 2) return;
    if (projects.length >= MAX_SUB_PROJECTS) return;

    let realDir: string;
    try {
      realDir = fs.realpathSync(dir);
    } catch {
      return;
    }
    if (visited.has(realDir)) return;
    visited.add(realDir);

    const relativePath = path.relative(targetDir, dir).replace(/\\/g, '/') || '.';
    let detected = false;

    for (const marker of PROJECT_MARKERS) {
      const markerFile = marker.files.find(file => fs.existsSync(path.join(dir, file)));
      if (!markerFile) continue;

      let lang = marker.lang;
      if (marker.refinements) {
        for (const refinement of marker.refinements) {
          if (refinement.files.some(file => fs.existsSync(path.join(dir, file)))) {
            lang = refinement.lang;
            break;
          }
        }
      }

      if (markerFile === 'package.json') {
        try {
          const pkgContent = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')) as PackageJson;
          const metadata = detectProjectMetadata(dir, lang, pkgContent);

          projects.push({
            name: pkgContent.name || path.basename(dir),
            relativePath,
            absolutePath: dir,
            lang,
            packageJson: pkgContent,
            vueProfile: metadata.vueProfile,
            dependencies: metadata.dependencies,
            matchedLayer2Rules: [],
            frameworkLabel: metadata.frameworkLabel,
            uiLibLabels: metadata.uiLibLabels,
            projectKind: metadata.projectKind,
            stackTags: metadata.stackTags,
          });
        } catch {
          logger.warn(`解析 package.json 失败: ${path.join(dir, 'package.json')}`);
        }
      } else {
        const metadata = detectProjectMetadata(dir, lang);
        projects.push({
          name: path.basename(dir),
          relativePath,
          absolutePath: dir,
          lang,
          vueProfile: metadata.vueProfile,
          dependencies: metadata.dependencies,
          matchedLayer2Rules: [],
          frameworkLabel: metadata.frameworkLabel,
          uiLibLabels: metadata.uiLibLabels,
          projectKind: metadata.projectKind,
          stackTags: metadata.stackTags,
        });
      }

      detected = true;
      break;
    }

    if (!detected) {
      try {
        const entries = fs.readdirSync(dir);
        const hasCsproj = entries.some(entry => entry.endsWith('.csproj') || entry.endsWith('.sln'));
        if (hasCsproj) {
          const metadata = detectProjectMetadata(dir, 'dotnet');
          projects.push({
            name: path.basename(dir),
            relativePath,
            absolutePath: dir,
            lang: 'dotnet',
            vueProfile: metadata.vueProfile,
            dependencies: metadata.dependencies,
            matchedLayer2Rules: [],
            frameworkLabel: metadata.frameworkLabel,
            uiLibLabels: metadata.uiLibLabels,
            projectKind: metadata.projectKind,
            stackTags: metadata.stackTags,
          });
          detected = true;
        }
      } catch {
        return;
      }
    }

    if (depth < 2) {
      let entries: string[];
      try {
        entries = fs.readdirSync(dir);
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.startsWith('.') || WORKSPACE_EXCLUDE_DIRS.has(entry)) continue;

        const childPath = path.join(dir, entry);
        try {
          if (fs.statSync(childPath).isDirectory()) {
            scan(childPath, depth + 1);
          }
        } catch {}
      }
    }
  }

  scan(targetDir, 0);

  if (projects.length >= MAX_SUB_PROJECTS) {
    logger.warn(`子项目数量已达上限 ${MAX_SUB_PROJECTS}，后续子项目被截断`);
  }

  const isWorkspace = projects.length > 1;

  if (isWorkspace) {
    logger.log(`发现 Workspace 模式：${projects.length} 个子项目`);
    for (const project of projects) {
      const label = [project.lang, project.frameworkLabel, ...project.uiLibLabels].filter(Boolean).join(' + ');
      logger.verbose(`  - ${project.relativePath} (${label || '无框架检测'})`);
    }
  }

  return {
    isWorkspace,
    rootDir: targetDir,
    projects,
    discoveredAt: new Date().toISOString(),
    scope: 'workspace-union',
    selectedProject: null,
    totalProjectCount: projects.length,
  };
}

export function detectProjectLangFromDir(projectDir: string): ProjectLang {
  for (const marker of PROJECT_MARKERS) {
    const markerFile = marker.files.find(file => fs.existsSync(path.join(projectDir, file)));
    if (!markerFile) continue;

    let lang = marker.lang;
    if (marker.refinements) {
      for (const refinement of marker.refinements) {
        if (refinement.files.some(file => fs.existsSync(path.join(projectDir, file)))) {
          lang = refinement.lang;
          break;
        }
      }
    }

    return lang;
  }

  try {
    const entries = fs.readdirSync(projectDir);
    if (entries.some(entry => entry.endsWith('.csproj') || entry.endsWith('.fsproj'))) {
      return 'dotnet';
    }
  } catch {
    return 'unknown';
  }

  return 'unknown';
}

function getProjectAliases(project: SubProject): string[] {
  const aliases = new Set<string>();
  aliases.add(project.relativePath);
  aliases.add(project.name);
  aliases.add(project.relativePath.split('/').pop() || project.relativePath);
  if (project.relativePath === '.') {
    aliases.add('root');
    aliases.add('.');
  }
  return [...aliases].map(normalizeSelector).filter(Boolean);
}

export function resolveTargetProject(workspaceInfo: WorkspaceInfo, selector: string): SubProject | null {
  const normalizedSelector = normalizeSelector(selector);
  if (!normalizedSelector) return null;

  const exact = workspaceInfo.projects.find(project => getProjectAliases(project).includes(normalizedSelector));
  if (exact) return exact;

  const prefixMatches = workspaceInfo.projects.filter(project =>
    normalizeSelector(project.relativePath).startsWith(normalizedSelector)
  );
  if (prefixMatches.length === 1) return prefixMatches[0];

  const fuzzyMatches = workspaceInfo.projects.filter(project =>
    getProjectAliases(project).some(alias => alias.includes(normalizedSelector))
  );
  if (fuzzyMatches.length === 1) return fuzzyMatches[0];

  return null;
}

export function createScopedWorkspaceInfo(
  workspaceInfo: WorkspaceInfo,
  workspaceScope: WorkspaceScope,
  targetProjectSelector: string | null,
): WorkspaceInfo {
  if (!workspaceInfo.isWorkspace || workspaceInfo.projects.length <= 1) {
    return {
      ...workspaceInfo,
      scope: workspaceScope,
      selectedProject: workspaceInfo.projects[0]?.relativePath || null,
      totalProjectCount: workspaceInfo.projects.length,
    };
  }

  if (workspaceScope !== 'project-targeted') {
    return {
      ...workspaceInfo,
      scope: 'workspace-union',
      selectedProject: null,
      totalProjectCount: workspaceInfo.projects.length,
    };
  }

  if (!targetProjectSelector) {
    throw new Error('project-targeted 模式需要配合 --project <selector>');
  }

  const selectedProject = resolveTargetProject(workspaceInfo, targetProjectSelector);
  if (!selectedProject) {
    throw new Error(`未找到匹配的子项目: ${targetProjectSelector}`);
  }

  return {
    ...workspaceInfo,
    isWorkspace: true,
    projects: [selectedProject],
    scope: 'project-targeted',
    selectedProject: selectedProject.relativePath,
    totalProjectCount: workspaceInfo.projects.length,
  };
}

"use strict";
/**
 * Contract Validator (dependency-free)
 *
 * Validate CodeBuddy contracts in the target project:
 * - Workflow Spec JSON (under .codebuddy/workflows)
 * - TaskBook JSON (under .codebuddy/taskbooks)
 *
 * This validator is intentionally dependency-free (Node built-ins only) so it can run
 * inside any business project where .codebuddy/scripts are distributed.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const TASKBOOK_STATUSES = new Set(['draft', 'confirmed', 'executing', 'completed', 'aborted']);
const TASKBOOK_TYPES = new Set(['new-feature', 'refactoring', 'debugging', 'testing', 'code-review']);
const TASK_TYPES = new Set(['analysis', 'design', 'test', 'implement', 'review']);
const TASK_STATUSES = new Set(['pending', 'in_progress', 'done', 'blocked', 'skipped']);
const TASK_PRIORITIES = new Set(['critical', 'high', 'medium', 'low']);
const CHANGE_TYPES = new Set(['added', 'modified', 'removed', 'reordered']);
const KNOWN_WORKFLOW_STEP_TYPES = new Set([
    'analyze_project',
    'create_taskbook',
    'implement_tasks',
    'run_tests',
    'code_review',
    'acceptance_and_archive',
]);
const KNOWN_WORKFLOW_GATE_TYPES = new Set(['checks', 'review']);
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function isStringArray(value) {
    return Array.isArray(value) && value.every(v => typeof v === 'string');
}
function isValidDateTime(value) {
    if (typeof value !== 'string')
        return false;
    const t = Date.parse(value);
    return Number.isFinite(t);
}
function readJsonFile(filePath) {
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        return { ok: true, data };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}
function listJsonFiles(dirPath, opts) {
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        return entries
            .filter(e => e.isFile())
            .map(e => e.name)
            .filter(name => name.endsWith('.json'))
            .filter(name => { var _a; return !((_a = opts === null || opts === void 0 ? void 0 : opts.exclude) === null || _a === void 0 ? void 0 : _a.has(name)); })
            .map(name => path.join(dirPath, name));
    }
    catch (_a) {
        return [];
    }
}
function validateTaskBook(data, file) {
    const issues = [];
    const error = (message) => issues.push({ level: 'error', file, message });
    const warn = (message) => issues.push({ level: 'warning', file, message });
    if (!isPlainObject(data)) {
        error('TaskBook must be a JSON object');
        return issues;
    }
    const requiredTop = ['id', 'title', 'description', 'taskType', 'createdAt', 'status', 'context', 'tasks', 'changelog'];
    for (const k of requiredTop) {
        if (!(k in data))
            error(`Missing required field: ${k}`);
    }
    if ('id' in data && !isNonEmptyString(data.id))
        error('id must be a non-empty string');
    if ('title' in data && !isNonEmptyString(data.title))
        error('title must be a non-empty string');
    if ('description' in data && typeof data.description !== 'string')
        error('description must be a string');
    if ('taskType' in data) {
        if (!isNonEmptyString(data.taskType) || !TASKBOOK_TYPES.has(data.taskType)) {
            error(`taskType must be one of: ${Array.from(TASKBOOK_TYPES).join(', ')}`);
        }
    }
    if ('status' in data) {
        if (!isNonEmptyString(data.status) || !TASKBOOK_STATUSES.has(data.status)) {
            error(`status must be one of: ${Array.from(TASKBOOK_STATUSES).join(', ')}`);
        }
    }
    if ('createdAt' in data && !isValidDateTime(data.createdAt)) {
        error('createdAt must be an ISO date-time string');
    }
    if ('updatedAt' in data && typeof data.updatedAt !== 'undefined' && !isValidDateTime(data.updatedAt)) {
        error('updatedAt must be an ISO date-time string (when provided)');
    }
    if ('revision' in data && typeof data.revision !== 'undefined') {
        const n = data.revision;
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
            error('revision must be a non-negative integer (when provided)');
        }
    }
    if ('confirmedAt' in data && typeof data.confirmedAt !== 'undefined' && !isValidDateTime(data.confirmedAt)) {
        error('confirmedAt must be an ISO date-time string (when provided)');
    }
    if ('completedAt' in data && typeof data.completedAt !== 'undefined' && !isValidDateTime(data.completedAt)) {
        error('completedAt must be an ISO date-time string (when provided)');
    }
    if ('context' in data) {
        if (!isPlainObject(data.context)) {
            error('context must be an object');
        }
        else {
            if (!('relatedFiles' in data.context) || !isStringArray(data.context.relatedFiles)) {
                error('context.relatedFiles must be an array of strings');
            }
            if (!('dependencies' in data.context) || !isStringArray(data.context.dependencies)) {
                error('context.dependencies must be an array of strings');
            }
            if ('architectureNotes' in data.context && typeof data.context.architectureNotes !== 'undefined' && typeof data.context.architectureNotes !== 'string') {
                error('context.architectureNotes must be a string (when provided)');
            }
            if ('projectHealth' in data.context && typeof data.context.projectHealth !== 'undefined') {
                const ph = data.context.projectHealth;
                if (!isPlainObject(ph)) {
                    error('context.projectHealth must be an object (when provided)');
                }
                else {
                    if (typeof ph.score !== 'number')
                        error('context.projectHealth.score must be a number');
                    if (!isStringArray(ph.issues))
                        error('context.projectHealth.issues must be an array of strings');
                }
            }
        }
    }
    const taskIdSet = new Set();
    if ('tasks' in data) {
        if (!Array.isArray(data.tasks)) {
            error('tasks must be an array');
        }
        else {
            for (const [index, t] of data.tasks.entries()) {
                if (!isPlainObject(t)) {
                    error(`tasks[${index}] must be an object`);
                    continue;
                }
                const requiredTask = ['id', 'title', 'type', 'status', 'priority', 'dependencies', 'acceptanceCriteria'];
                for (const k of requiredTask) {
                    if (!(k in t))
                        error(`tasks[${index}] missing required field: ${k}`);
                }
                if (!isNonEmptyString(t.id))
                    error(`tasks[${index}].id must be a non-empty string`);
                if (isNonEmptyString(t.id)) {
                    if (taskIdSet.has(t.id))
                        error(`Duplicate task id: ${t.id}`);
                    taskIdSet.add(t.id);
                }
                if (!isNonEmptyString(t.title))
                    error(`tasks[${index}].title must be a non-empty string`);
                if (!isNonEmptyString(t.type) || !TASK_TYPES.has(t.type)) {
                    error(`tasks[${index}].type must be one of: ${Array.from(TASK_TYPES).join(', ')}`);
                }
                if (!isNonEmptyString(t.status) || !TASK_STATUSES.has(t.status)) {
                    error(`tasks[${index}].status must be one of: ${Array.from(TASK_STATUSES).join(', ')}`);
                }
                if (!isNonEmptyString(t.priority) || !TASK_PRIORITIES.has(t.priority)) {
                    error(`tasks[${index}].priority must be one of: ${Array.from(TASK_PRIORITIES).join(', ')}`);
                }
                if (!isStringArray(t.dependencies))
                    error(`tasks[${index}].dependencies must be an array of strings`);
                if (!isStringArray(t.acceptanceCriteria))
                    error(`tasks[${index}].acceptanceCriteria must be an array of strings`);
                if ('scope' in t && typeof t.scope !== 'undefined') {
                    const scope = t.scope;
                    if (!isPlainObject(scope)) {
                        error(`tasks[${index}].scope must be an object (when provided)`);
                    }
                    else {
                        if ('files' in scope && typeof scope.files !== 'undefined' && !isStringArray(scope.files)) {
                            error(`tasks[${index}].scope.files must be an array of strings (when provided)`);
                        }
                        if ('modules' in scope && typeof scope.modules !== 'undefined' && !isStringArray(scope.modules)) {
                            error(`tasks[${index}].scope.modules must be an array of strings (when provided)`);
                        }
                        if ('tags' in scope && typeof scope.tags !== 'undefined' && !isStringArray(scope.tags)) {
                            error(`tasks[${index}].scope.tags must be an array of strings (when provided)`);
                        }
                    }
                }
                if ('executedBy' in t && typeof t.executedBy !== 'undefined' && typeof t.executedBy !== 'string') {
                    error(`tasks[${index}].executedBy must be a string (when provided)`);
                }
                if ('actualWork' in t && typeof t.actualWork !== 'undefined' && typeof t.actualWork !== 'string') {
                    error(`tasks[${index}].actualWork must be a string (when provided)`);
                }
                if ('blockedReason' in t && typeof t.blockedReason !== 'undefined' && typeof t.blockedReason !== 'string') {
                    error(`tasks[${index}].blockedReason must be a string (when provided)`);
                }
                if ('startedAt' in t && typeof t.startedAt !== 'undefined' && !isValidDateTime(t.startedAt)) {
                    error(`tasks[${index}].startedAt must be an ISO date-time string (when provided)`);
                }
                if ('completedAt' in t && typeof t.completedAt !== 'undefined' && !isValidDateTime(t.completedAt)) {
                    error(`tasks[${index}].completedAt must be an ISO date-time string (when provided)`);
                }
            }
            // dependency check
            for (const [index, t] of data.tasks.entries()) {
                if (!isPlainObject(t))
                    continue;
                if (!isNonEmptyString(t.id))
                    continue;
                if (!isStringArray(t.dependencies))
                    continue;
                for (const dep of t.dependencies) {
                    if (!taskIdSet.has(dep)) {
                        error(`tasks[${index}].dependencies contains unknown task id: ${dep}`);
                    }
                }
            }
        }
    }
    if ('changelog' in data) {
        if (!Array.isArray(data.changelog)) {
            error('changelog must be an array');
        }
        else {
            for (const [index, c] of data.changelog.entries()) {
                if (!isPlainObject(c)) {
                    error(`changelog[${index}] must be an object`);
                    continue;
                }
                const requiredChange = ['timestamp', 'taskId', 'changeType', 'reason'];
                for (const k of requiredChange) {
                    if (!(k in c))
                        error(`changelog[${index}] missing required field: ${k}`);
                }
                if (!isValidDateTime(c.timestamp))
                    error(`changelog[${index}].timestamp must be an ISO date-time string`);
                if (typeof c.taskId !== 'string' && c.taskId !== null)
                    error(`changelog[${index}].taskId must be string|null`);
                if (!isNonEmptyString(c.changeType) || !CHANGE_TYPES.has(c.changeType)) {
                    error(`changelog[${index}].changeType must be one of: ${Array.from(CHANGE_TYPES).join(', ')}`);
                }
                if (typeof c.reason !== 'string')
                    error(`changelog[${index}].reason must be a string`);
            }
        }
    }
    // soft checks
    if (data.status === 'confirmed' && !('confirmedAt' in data))
        warn('status is confirmed but confirmedAt is missing');
    if ((data.status === 'completed' || data.status === 'aborted') && !('completedAt' in data))
        warn('status is completed/aborted but completedAt is missing');
    return issues;
}
function validateWorkflowSpec(data, file, opts) {
    var _a;
    const issues = [];
    const error = (message) => issues.push({ level: 'error', file, message });
    const warn = (message) => issues.push({ level: 'warning', file, message });
    const strict = (opts === null || opts === void 0 ? void 0 : opts.strict) === true;
    if (!isPlainObject(data)) {
        error('Workflow spec must be a JSON object');
        return issues;
    }
    if (!('id' in data) || !isNonEmptyString(data.id))
        error('id must be a non-empty string');
    if (!('version' in data) || !isNonEmptyString(data.version))
        error('version must be a non-empty string');
    if (!('steps' in data) || !Array.isArray(data.steps)) {
        error('steps must be an array');
        return issues;
    }
    const stepIds = new Set();
    for (const [index, s] of data.steps.entries()) {
        if (!isPlainObject(s)) {
            error(`steps[${index}] must be an object`);
            continue;
        }
        if (!isNonEmptyString(s.id))
            error(`steps[${index}].id must be a non-empty string`);
        if (isNonEmptyString(s.id)) {
            if (stepIds.has(s.id))
                error(`Duplicate step id: ${s.id}`);
            stepIds.add(s.id);
        }
        if (!isNonEmptyString(s.type))
            error(`steps[${index}].type must be a non-empty string`);
        if (isNonEmptyString(s.type) && strict && !KNOWN_WORKFLOW_STEP_TYPES.has(s.type)) {
            error(`steps[${index}].type is unknown: ${s.type}`);
        }
        else if (isNonEmptyString(s.type) && !KNOWN_WORKFLOW_STEP_TYPES.has(s.type)) {
            warn(`steps[${index}].type is not recognized by default executor: ${s.type}`);
        }
        if (!isNonEmptyString(s.title))
            error(`steps[${index}].title must be a non-empty string`);
        if ('gates' in s && typeof s.gates !== 'undefined') {
            if (!isStringArray(s.gates))
                error(`steps[${index}].gates must be an array of strings (when provided)`);
        }
    }
    const gateIds = new Set();
    if ('gates' in data && typeof data.gates !== 'undefined') {
        if (!Array.isArray(data.gates)) {
            error('gates must be an array (when provided)');
        }
        else {
            for (const [index, g] of data.gates.entries()) {
                if (!isPlainObject(g)) {
                    error(`gates[${index}] must be an object`);
                    continue;
                }
                if (!isNonEmptyString(g.id))
                    error(`gates[${index}].id must be a non-empty string`);
                if (isNonEmptyString(g.id)) {
                    if (gateIds.has(g.id))
                        error(`Duplicate gate id: ${g.id}`);
                    gateIds.add(g.id);
                }
                if (!isNonEmptyString(g.type))
                    error(`gates[${index}].type must be a non-empty string`);
                if (isNonEmptyString(g.type) && strict && !KNOWN_WORKFLOW_GATE_TYPES.has(g.type)) {
                    error(`gates[${index}].type is unknown: ${g.type}`);
                }
                if (!isNonEmptyString(g.title))
                    warn(`gates[${index}].title is recommended`);
                if (g.type === 'checks') {
                    const params = ((_a = g.params) !== null && _a !== void 0 ? _a : null);
                    if (!isPlainObject(params)) {
                        error(`gates[${index}].params must be an object for checks gate`);
                    }
                    else {
                        const commands = params.commands;
                        const npmScripts = params.npmScripts;
                        const commandsOk = Array.isArray(commands) && commands.every(c => typeof c === 'string' && c.trim().length > 0);
                        const npmScriptsOk = Array.isArray(npmScripts) && npmScripts.every(s => typeof s === 'string' && s.trim().length > 0);
                        if (!commandsOk && !npmScriptsOk) {
                            error(`gates[${index}].params must define non-empty commands[] or npmScripts[] for checks gate`);
                        }
                    }
                }
            }
        }
    }
    // step.gates references
    for (const [index, s] of data.steps.entries()) {
        if (!isPlainObject(s))
            continue;
        if (!('gates' in s) || typeof s.gates === 'undefined')
            continue;
        if (!isStringArray(s.gates))
            continue;
        for (const gid of s.gates) {
            if (!gateIds.has(gid)) {
                error(`steps[${index}].gates references unknown gate: ${gid}`);
            }
        }
    }
    if ('edges' in data && typeof data.edges !== 'undefined') {
        if (!Array.isArray(data.edges)) {
            error('edges must be an array (when provided)');
        }
        else {
            for (const [index, e] of data.edges.entries()) {
                if (!isPlainObject(e)) {
                    error(`edges[${index}] must be an object`);
                    continue;
                }
                const from = e.from;
                const to = e.to;
                if (!isNonEmptyString(from) || !isNonEmptyString(to)) {
                    error(`edges[${index}] must have non-empty from/to`);
                    continue;
                }
                if (!stepIds.has(from))
                    error(`edges[${index}].from references unknown step: ${from}`);
                if (!stepIds.has(to))
                    error(`edges[${index}].to references unknown step: ${to}`);
            }
        }
    }
    return issues;
}
function parseArgs(argv) {
    var _a, _b;
    const parsed = {
        validateWorkflows: false,
        validateTaskbooks: false,
        workflowPaths: [],
        taskBookIds: [],
        strict: false,
        checkBatchingScope: false,
        strictBatchingScope: false,
        json: false,
        quiet: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--workflows')
            parsed.validateWorkflows = true;
        else if (a === '--taskbooks')
            parsed.validateTaskbooks = true;
        else if (a === '--workflow')
            parsed.workflowPaths.push(String((_a = argv[++i]) !== null && _a !== void 0 ? _a : ''));
        else if (a === '--taskbook')
            parsed.taskBookIds.push(String((_b = argv[++i]) !== null && _b !== void 0 ? _b : ''));
        else if (a === '--strict')
            parsed.strict = true;
        else if (a === '--check-batching-scope')
            parsed.checkBatchingScope = true;
        else if (a === '--strict-batching-scope')
            parsed.strictBatchingScope = true;
        else if (a === '--json')
            parsed.json = true;
        else if (a === '--quiet')
            parsed.quiet = true;
        else if (a === '--help' || a === '-h') {
            // handled by caller
        }
        else {
            // ignore unknown flags for forward compatibility
        }
    }
    // default: validate both
    if (!parsed.validateWorkflows && !parsed.validateTaskbooks && parsed.workflowPaths.length === 0 && parsed.taskBookIds.length === 0) {
        parsed.validateWorkflows = true;
        parsed.validateTaskbooks = true;
    }
    parsed.workflowPaths = parsed.workflowPaths.filter(Boolean);
    parsed.taskBookIds = parsed.taskBookIds.filter(Boolean);
    if (parsed.strictBatchingScope)
        parsed.checkBatchingScope = true;
    return parsed;
}
function showHelp() {
    console.log(`
Contract Validator (CodeBuddy)

Usage:
  node .codebuddy/scripts/contract-validator.js [options]

Options:
  --workflows                 validate workflows under .codebuddy/workflows
  --workflow <path>           validate a specific workflow JSON file
  --taskbooks                 validate TaskBooks under .codebuddy/taskbooks/active
  --taskbook <id>             validate a specific TaskBook id (active/history)
  --strict                    treat unknown workflow step/gate types as errors
  --check-batching-scope      warn when batching is enabled but tasks lack scope.files/modules
  --strict-batching-scope     error when batching is enabled but tasks lack scope.files/modules
  --json                      output machine-readable JSON
  --quiet                     only output errors (text mode)
`);
}
function workflowHasRiskTieredBatching(data) {
    if (!isPlainObject(data))
        return false;
    const policies = data.policies;
    if (!isPlainObject(policies))
        return false;
    const testing = policies.testing;
    if (!isPlainObject(testing))
        return false;
    const batching = testing.batching;
    if (!isPlainObject(batching))
        return false;
    return batching.strategy === 'risk_tiered';
}
function batchingScopeIssues(taskBookData, file, opts) {
    const issues = [];
    const level = opts.strict ? 'error' : 'warning';
    if (!isPlainObject(taskBookData))
        return issues;
    const tasks = taskBookData.tasks;
    if (!Array.isArray(tasks))
        return issues;
    const missing = [];
    for (const t of tasks) {
        if (!isPlainObject(t))
            continue;
        const type = typeof t.type === 'string' ? t.type : '';
        const status = typeof t.status === 'string' ? t.status : '';
        if (type !== 'analysis' && type !== 'design' && type !== 'implement')
            continue;
        if (status !== 'pending')
            continue;
        const id = typeof t.id === 'string' ? t.id : '<unknown>';
        const title = typeof t.title === 'string' ? t.title : '';
        const scope = t.scope;
        if (!isPlainObject(scope)) {
            missing.push({ id, title, type, status });
            continue;
        }
        const files = Array.isArray(scope.files) ? scope.files.filter(v => typeof v === 'string' && v.trim().length > 0) : [];
        const modules = Array.isArray(scope.modules) ? scope.modules.filter(v => typeof v === 'string' && v.trim().length > 0) : [];
        if (files.length === 0 && modules.length === 0) {
            missing.push({ id, title, type, status });
        }
    }
    if (missing.length > 0) {
        const examples = missing
            .slice(0, 5)
            .map(t => `${t.id}:${t.title || t.type}`)
            .join(', ');
        const more = missing.length > 5 ? ` (+${missing.length - 5} more)` : '';
        issues.push({
            level,
            file,
            message: `Batching scope check: ${missing.length} pending tasks (analysis/design/implement) lack scope.files/modules. Examples: ${examples}${more}. Consider adding tasks with --files/--modules.`,
        });
    }
    return issues;
}
function main() {
    const argv = process.argv.slice(2);
    if (argv.includes('--help') || argv.includes('-h')) {
        showHelp();
        process.exit(0);
    }
    const args = parseArgs(argv);
    const issues = [];
    // workflows
    const workflowFiles = [];
    if (args.workflowPaths.length > 0) {
        for (const p of args.workflowPaths)
            workflowFiles.push(path.resolve(process.cwd(), p));
    }
    else if (args.validateWorkflows) {
        const dir = path.join(process.cwd(), '.codebuddy', 'workflows');
        workflowFiles.push(...listJsonFiles(dir, { exclude: new Set(['workflow.schema.json']) }));
    }
    // If batching-scope checks are enabled, we need workflow policies even when --workflows wasn't requested.
    if (args.checkBatchingScope && workflowFiles.length === 0) {
        const dir = path.join(process.cwd(), '.codebuddy', 'workflows');
        workflowFiles.push(...listJsonFiles(dir, { exclude: new Set(['workflow.schema.json']) }));
    }
    const workflowData = [];
    for (const f of workflowFiles) {
        const r = readJsonFile(f);
        if (!r.ok) {
            issues.push({ level: 'error', file: f, message: `Failed to read/parse JSON: ${r.error}` });
            continue;
        }
        workflowData.push({ file: f, data: r.data });
        issues.push(...validateWorkflowSpec(r.data, f, { strict: args.strict }));
    }
    // taskbooks
    const taskBookFiles = [];
    if (args.taskBookIds.length > 0) {
        for (const id of args.taskBookIds) {
            const active = path.join(process.cwd(), '.codebuddy', 'taskbooks', 'active', `${id}.json`);
            const history = path.join(process.cwd(), '.codebuddy', 'taskbooks', 'history', `${id}.json`);
            if (fs.existsSync(active))
                taskBookFiles.push(active);
            else if (fs.existsSync(history))
                taskBookFiles.push(history);
            else
                issues.push({ level: 'error', file: id, message: 'TaskBook not found in active/history' });
        }
    }
    else if (args.validateTaskbooks) {
        const dir = path.join(process.cwd(), '.codebuddy', 'taskbooks', 'active');
        taskBookFiles.push(...listJsonFiles(dir));
    }
    if (args.checkBatchingScope && taskBookFiles.length === 0 && args.taskBookIds.length === 0) {
        const dir = path.join(process.cwd(), '.codebuddy', 'taskbooks', 'active');
        taskBookFiles.push(...listJsonFiles(dir));
    }
    const taskBookData = [];
    for (const f of taskBookFiles) {
        const r = readJsonFile(f);
        if (!r.ok) {
            issues.push({ level: 'error', file: f, message: `Failed to read/parse JSON: ${r.error}` });
            continue;
        }
        taskBookData.push({ file: f, data: r.data });
        issues.push(...validateTaskBook(r.data, f));
    }
    if (args.checkBatchingScope) {
        const batchingEnabled = workflowData.some(w => workflowHasRiskTieredBatching(w.data));
        if (batchingEnabled) {
            for (const tb of taskBookData) {
                issues.push(...batchingScopeIssues(tb.data, tb.file, { strict: args.strictBatchingScope }));
            }
        }
    }
    const errors = issues.filter(i => i.level === 'error');
    const warnings = issues.filter(i => i.level === 'warning');
    const ok = errors.length === 0;
    if (args.json) {
        // do not include huge content, only summary
        console.log(JSON.stringify({
            ok,
            totals: { files: { workflows: workflowFiles.length, taskbooks: taskBookFiles.length }, errors: errors.length, warnings: warnings.length },
            issues,
        }, null, 2));
    }
    else {
        if (ok) {
            if (!args.quiet) {
                console.log(`[OK] contracts valid | workflows=${workflowFiles.length} taskbooks=${taskBookFiles.length} warnings=${warnings.length}`);
            }
        }
        else {
            console.error(`[FAIL] contract validation failed | errors=${errors.length} warnings=${warnings.length}`);
        }
        for (const i of issues) {
            if (args.quiet && i.level !== 'error')
                continue;
            const prefix = i.level === 'error' ? 'ERROR' : 'WARN ';
            const out = `${prefix} ${i.file}: ${i.message}`;
            if (i.level === 'error')
                console.error(out);
            else
                console.warn(out);
        }
    }
    process.exit(ok ? 0 : 1);
}
if (require.main === module) {
    main();
}

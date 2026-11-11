// Executa os testes de unidade no Node:  node tests/run-unit.mjs
import './dom-stub.mjs';
import { runAll } from './lib.mjs';
import './unit/save.test.mjs';
import './unit/ai.test.mjs';
import './unit/phase2.test.mjs';
import './unit/phase3.test.mjs';
const r = await runAll();
process.exit(r.fail ? 1 : 0);

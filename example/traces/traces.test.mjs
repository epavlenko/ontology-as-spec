// The checks of the catalogue run on the code (rule.trace-runs-on-code): each test runs its check's
// trace on library.mjs through the adapter, as ont-check --run runs it on the oracle. ont-check --mutate
// runs the same tests on the oracle with one form changed, where each must fail when its trace does.
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import * as adapter from "../app/adapter.mjs";

// The tool, as ont-check gives it when it loads this file, or from the copy beside the example.
const { codeTests } = globalThis.__ontCheck ?? (await import("../../tools/ont-check/code-traces.mjs"));

const checkTest = codeTests({ config: fileURLToPath(new URL("../ont.config.json", import.meta.url)), adapter, test });

checkTest("[check.member.limit-refusal-explained] its trace on the code");
checkTest("[check.item.one-open-loan] its trace on the code");
checkTest("[check.loan.due-in-21-days] its trace on the code");
checkTest("[check.loan.renew-twice] its trace on the code");
checkTest("[check.loan.renew-while-held] its trace on the code");
checkTest("[check.loan.overdue-after-due] its trace on the code");
checkTest("[check.loan.return-closes-loan] its trace on the code");
checkTest("[check.loan.nothing-to-act-on] its trace on the code");
checkTest("[check.hold.only-when-all-out] its trace on the code");
checkTest("[check.hold.position-shown] its trace on the code");
checkTest("[check.hold.unknown-member] its trace on the code");

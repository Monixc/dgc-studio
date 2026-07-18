/**
 * 확장-모듈 — 표준 라이브러리 import + module.fn() 블록
 * random, math, statistics, json, itertools, functools, operator, re, os.path, copy, string
 */

import type { BlockUi } from "./blockUi";

const STDLIB = "#6888a8";

interface SlotDef {
  name: string;
  kind: "text" | "expr" | "bool" | "var";
  default: string;
  width?: number;
}

export interface StdlibBlockDef {
  id: string;
  category: string;
  label: string;
  shape: "stack" | "c_block" | "reporter";
  hasElse?: boolean;
  slots: SlotDef[];
  color: string;
  code: string;
  ui: BlockUi;
}

function slot(name: string, kind: SlotDef["kind"], defaultVal: string, width?: number): SlotDef {
  return { name, kind, default: defaultVal, width };
}

function importModule(module: string, label?: string): StdlibBlockDef {
  return {
    id: `ext_import_${module.replace(/\./g, "_")}`,
    category: "ext_stdlib",
    label: label ?? `import ${module}`,
    shape: "stack",
    slots: [],
    color: STDLIB,
    code: `import ${module}`,
    ui: { type: "import_module", module },
  };
}

function fromImport(module: string, name: string, label?: string): StdlibBlockDef {
  return {
    id: `ext_from_${module.replace(/\./g, "_")}_${name}`,
    category: "ext_stdlib",
    label: label ?? `from ${module} import ${name}`,
    shape: "stack",
    slots: [],
    color: STDLIB,
    code: `from ${module} import ${name}`,
    ui: { type: "from_import_const", module, name },
  };
}

type ArgSpec = { name: string; default: string; width?: number };

function modCall(
  id: string,
  module: string,
  fn: string,
  label: string,
  args: ArgSpec[] = [],
  code?: string,
): StdlibBlockDef {
  const argNames = args.map((a) => a.name);
  const argSlots = args.map((a) => slot(a.name, "expr", a.default, a.width ?? 56));
  const callArgs = argNames.map((n) => `{${n}}`).join(", ");
  return {
    id,
    category: "ext_stdlib",
    label,
    shape: "stack",
    slots: [slot("result", "var", "result", 72), ...argSlots],
    color: STDLIB,
    code: code ?? `{result} = ${module}.${fn}(${callArgs})`,
    ui: { type: "mod_call", module, fn, args: argNames, result: "result" },
  };
}

function modVoid(
  id: string,
  module: string,
  fn: string,
  label: string,
  args: ArgSpec[] = [],
): StdlibBlockDef {
  const argNames = args.map((a) => a.name);
  const argSlots = args.map((a) => slot(a.name, "expr", a.default, a.width ?? 56));
  const callArgs = argNames.map((n) => `{${n}}`).join(", ");
  return {
    id,
    category: "ext_stdlib",
    label,
    shape: "stack",
    slots: argSlots,
    color: STDLIB,
    code: `${module}.${fn}(${callArgs})`,
    ui: { type: "mod_void", module, fn, args: argNames },
  };
}

function modConst(
  id: string,
  module: string,
  name: string,
  label: string,
  defaultResult = "value",
): StdlibBlockDef {
  return {
    id,
    category: "ext_stdlib",
    label,
    shape: "stack",
    slots: [slot("result", "var", defaultResult, 72)],
    color: STDLIB,
    code: `{result} = ${module}.${name}`,
    ui: { type: "mod_const", module, name, result: "result" },
  };
}

// ── import 문 ───────────────────────────────────────────────────────

const IMPORT_MODULES = [
  "random", "math", "statistics", "json", "itertools", "functools",
  "operator", "re", "copy", "string", "time", "datetime", "decimal",
  "fractions", "collections", "heapq", "bisect", "cmath",
] as const;

const IMPORT_BLOCKS = IMPORT_MODULES.map((m) => importModule(m));

// ── random ──────────────────────────────────────────────────────────

const RANDOM_FNS: Array<[string, string, ArgSpec[]]> = [
  ["randint", "randint(a,b)", [{ name: "a", default: "1" }, { name: "b", default: "6" }]],
  ["random", "random()", []],
  ["uniform", "uniform(a,b)", [{ name: "a", default: "0" }, { name: "b", default: "1" }]],
  ["choice", "choice(seq)", [{ name: "seq", default: "party", width: 80 }]],
  ["randrange", "randrange(stop)", [{ name: "stop", default: "10" }]],
  [
    "randrange_ab",
    "randrange(a,b)",
    [{ name: "a", default: "0" }, { name: "b", default: "10" }],
  ],
  ["sample", "sample(pop,k)", [{ name: "pop", default: "party" }, { name: "k", default: "2" }]],
];

const RANDOM_VOID: Array<[string, string, ArgSpec[]]> = [
  ["shuffle", "shuffle(lst)", [{ name: "lst", default: "party", width: 80 }]],
  ["seed", "seed(n)", [{ name: "n", default: "42" }]],
];

// ── math ────────────────────────────────────────────────────────────

const MATH_UNARY: Array<[string, string, string]> = [
  ["sqrt", "sqrt(x)", "4"],
  ["floor", "floor(x)", "3.7"],
  ["ceil", "ceil(x)", "3.2"],
  ["trunc", "trunc(x)", "3.7"],
  ["fabs", "fabs(x)", "damage"],
  ["factorial", "factorial(n)", "5"],
  ["isqrt", "isqrt(n)", "16"],
  ["degrees", "degrees(rad)", "3.14"],
  ["radians", "radians(deg)", "180"],
  ["sin", "sin(x)", "1"],
  ["cos", "cos(x)", "0"],
  ["tan", "tan(x)", "1"],
  ["asin", "asin(x)", "0.5"],
  ["acos", "acos(x)", "0.5"],
  ["atan", "atan(x)", "1"],
  ["sinh", "sinh(x)", "1"],
  ["cosh", "cosh(x)", "1"],
  ["tanh", "tanh(x)", "1"],
  ["log", "log(x)", "10"],
  ["log10", "log10(x)", "100"],
  ["log2", "log2(x)", "8"],
  ["exp", "exp(x)", "1"],
];

const MATH_BINARY: Array<[string, string, string, string]> = [
  ["pow", "pow(x,y)", "2", "8"],
  ["gcd", "gcd(a,b)", "12", "18"],
  ["lcm", "lcm(a,b)", "4", "6"],
  ["hypot", "hypot(x,y)", "3", "4"],
  ["fmod", "fmod(x,y)", "7", "3"],
  ["atan2", "atan2(y,x)", "1", "1"],
  ["copysign", "copysign(x,y)", "1", "-1"],
  ["comb", "comb(n,k)", "5", "2"],
  ["perm", "perm(n,k)", "5", "2"],
];

const MATH_CONST: Array<[string, string]> = [["pi", "pi"], ["e", "e"], ["tau", "tau"], ["inf", "inf"]];

// ── statistics ──────────────────────────────────────────────────────

const STATS_FNS: Array<[string, string, ArgSpec[]]> = [
  ["mean", "mean(data)", [{ name: "data", default: "scores", width: 80 }]],
  ["median", "median(data)", [{ name: "data", default: "scores", width: 80 }]],
  ["mode", "mode(data)", [{ name: "data", default: "scores", width: 80 }]],
  ["stdev", "stdev(data)", [{ name: "data", default: "scores", width: 80 }]],
  ["variance", "variance(data)", [{ name: "data", default: "scores", width: 80 }]],
  ["pstdev", "pstdev(data)", [{ name: "data", default: "scores", width: 80 }]],
  ["pvariance", "pvariance(data)", [{ name: "data", default: "scores", width: 80 }]],
];

// ── json ────────────────────────────────────────────────────────────

const JSON_FNS: Array<[string, string, ArgSpec[]]> = [
  ["loads", "loads(s)", [{ name: "s", default: '\'{"hp": 40}\'', width: 120 }]],
  ["dumps", "dumps(obj)", [{ name: "obj", default: "pokemon", width: 80 }]],
];

// ── itertools ───────────────────────────────────────────────────────

const ITER_FNS: Array<{ id: string; fn: string; label: string; args: ArgSpec[]; code: string }> = [
  { id: "chain", fn: "chain", label: "chain(a,b)", args: [{ name: "a", default: "party" }, { name: "b", default: "box" }], code: "{result} = list(itertools.chain({a}, {b}))" },
  { id: "repeat", fn: "repeat", label: "repeat(x,n)", args: [{ name: "x", default: "0" }, { name: "n", default: "3" }], code: "{result} = list(itertools.repeat({x}, {n}))" },
  { id: "zip_longest", fn: "zip_longest", label: "zip_longest(a,b)", args: [{ name: "a", default: "party" }, { name: "b", default: "box" }], code: "{result} = list(itertools.zip_longest({a}, {b}))" },
  { id: "product", fn: "product", label: "product(a,b)", args: [{ name: "a", default: "types" }, { name: "b", default: "moves" }], code: "{result} = list(itertools.product({a}, {b}))" },
  { id: "permutations", fn: "permutations", label: "permutations(seq)", args: [{ name: "seq", default: "party" }], code: "{result} = list(itertools.permutations({seq}))" },
  { id: "permutations_r", fn: "permutations", label: "permutations(seq,r)", args: [{ name: "seq", default: "party" }, { name: "r", default: "2" }], code: "{result} = list(itertools.permutations({seq}, {r}))" },
  { id: "combinations", fn: "combinations", label: "combinations(seq,r)", args: [{ name: "seq", default: "party" }, { name: "r", default: "2" }], code: "{result} = list(itertools.combinations({seq}, {r}))" },
  { id: "combinations_rep", fn: "combinations_with_replacement", label: "combinations_with_replacement(seq,r)", args: [{ name: "seq", default: "party" }, { name: "r", default: "2" }], code: "{result} = list(itertools.combinations_with_replacement({seq}, {r}))" },
];

// ── functools / operator ────────────────────────────────────────────

const FUNCTOOLS_FNS: Array<[string, string, ArgSpec[], string?]> = [
  [
    "reduce",
    "reduce(fn, seq)",
    [{ name: "fn", default: "operator.add" }, { name: "seq", default: "scores", width: 80 }],
    "{result} = functools.reduce({fn}, {seq})",
  ],
];

const OPERATOR_FNS: Array<[string, string, ArgSpec[]]> = [
  ["add", "add(a,b)", [{ name: "a", default: "a" }, { name: "b", default: "b" }]],
  ["sub", "sub(a,b)", [{ name: "a", default: "a" }, { name: "b", default: "b" }]],
  ["mul", "mul(a,b)", [{ name: "a", default: "a" }, { name: "b", default: "b" }]],
  ["truediv", "truediv(a,b)", [{ name: "a", default: "a" }, { name: "b", default: "b" }]],
  ["floordiv", "floordiv(a,b)", [{ name: "a", default: "a" }, { name: "b", default: "b" }]],
  ["mod", "mod(a,b)", [{ name: "a", default: "a" }, { name: "b", default: "b" }]],
  ["pow", "pow(a,b)", [{ name: "a", default: "a" }, { name: "b", default: "b" }]],
  ["eq", "eq(a,b)", [{ name: "a", default: "a" }, { name: "b", default: "b" }]],
  ["lt", "lt(a,b)", [{ name: "a", default: "a" }, { name: "b", default: "b" }]],
  ["le", "le(a,b)", [{ name: "a", default: "a" }, { name: "b", default: "b" }]],
  ["gt", "gt(a,b)", [{ name: "a", default: "a" }, { name: "b", default: "b" }]],
  ["ge", "ge(a,b)", [{ name: "a", default: "a" }, { name: "b", default: "b" }]],
  ["neg", "neg(x)", [{ name: "x", default: "x" }]],
  ["not_", "not_(x)", [{ name: "x", default: "flag" }]],
  ["getitem", "getitem(obj,i)", [{ name: "obj", default: "party" }, { name: "i", default: "0" }]],
];

// ── re ──────────────────────────────────────────────────────────────

const RE_FNS: Array<[string, string, ArgSpec[]]> = [
  ["search", "search(pat,s)", [{ name: "pat", default: '"\\\\d+"' }, { name: "s", default: "text" }]],
  ["match", "match(pat,s)", [{ name: "pat", default: '"^피"' }, { name: "s", default: "text" }]],
  ["findall", "findall(pat,s)", [{ name: "pat", default: '"[가-힣]+"' }, { name: "s", default: "text" }]],
  ["split", "split(pat,s)", [{ name: "pat", default: '","' }, { name: "s", default: "text" }]],
  ["sub", "sub(pat,rep,s)", [{ name: "pat", default: '"나쁜"' }, { name: "rep", default: '"좋은"' }, { name: "s", default: "text" }]],
];

// ── copy / time / string ────────────────────────────────────────────

const COPY_FNS: Array<[string, string, ArgSpec[]]> = [
  ["copy", "copy(x)", [{ name: "x", default: "party", width: 80 }]],
  ["deepcopy", "deepcopy(x)", [{ name: "x", default: "pokemon", width: 80 }]],
];

const TIME_FNS: Array<[string, string, ArgSpec[]]> = [
  ["time", "time()", []],
];

const STRING_CONST: Array<[string, string, string]> = [
  ["ascii_letters", "ascii_letters", "letters"],
  ["ascii_lowercase", "ascii_lowercase", "lower"],
  ["ascii_uppercase", "ascii_uppercase", "upper"],
  ["digits", "digits", "digits"],
  ["hexdigits", "hexdigits", "hexdigits"],
  ["punctuation", "punctuation", "punct"],
  ["whitespace", "whitespace", "ws"],
];

// ── os.path (import os 후 사용 — 별도 import os 블록 추가) ─────────

function buildStdlibBlocks(): Record<string, StdlibBlockDef> {
  const out: Record<string, StdlibBlockDef> = {};

  for (const b of IMPORT_BLOCKS) out[b.id] = b;
  out.ext_import_os = importModule("os", "import os");

  for (const [fn, label, args] of RANDOM_FNS) {
    const id = fn === "randrange_ab" ? "ext_random_randrange_ab" : `ext_random_${fn}`;
    const realFn = fn === "randrange_ab" ? "randrange" : fn;
    out[id] = modCall(id, "random", realFn, `random.${label}`, args);
  }
  for (const [fn, label, args] of RANDOM_VOID) {
    out[`ext_random_${fn}`] = modVoid(`ext_random_${fn}`, "random", fn, `random.${label}`, args);
  }

  const mathUnarySeen = new Set<string>();
  for (const [fn, label, def] of MATH_UNARY) {
    if (mathUnarySeen.has(fn)) continue;
    mathUnarySeen.add(fn);
    out[`ext_math_${fn}`] = modCall(`ext_math_${fn}`, "math", fn, `math.${label}`, [{ name: "x", default: def }]);
  }
  for (const [fn, label, a, b] of MATH_BINARY) {
    out[`ext_math_${fn}`] = modCall(`ext_math_${fn}`, "math", fn, `math.${label}`, [
      { name: "a", default: a },
      { name: "b", default: b },
    ]);
  }
  for (const [name, label] of MATH_CONST) {
    out[`ext_math_${name}`] = modConst(`ext_math_${name}`, "math", name, `math.${label}`);
  }

  for (const [fn, label, args] of STATS_FNS) {
    out[`ext_stats_${fn}`] = modCall(`ext_stats_${fn}`, "statistics", fn, `statistics.${label}`, args);
  }
  for (const [fn, label, args] of JSON_FNS) {
    out[`ext_json_${fn}`] = modCall(`ext_json_${fn}`, "json", fn, `json.${label}`, args);
  }
  for (const item of ITER_FNS) {
    out[`ext_iter_${item.id}`] = modCall(
      `ext_iter_${item.id}`,
      "itertools",
      item.fn,
      `itertools.${item.label}`,
      item.args,
      item.code,
    );
  }
  for (const [idSuffix, label, args, code] of FUNCTOOLS_FNS) {
    out[`ext_functools_${idSuffix}`] = modCall(`ext_functools_${idSuffix}`, "functools", "reduce", `functools.${label}`, args, code);
  }
  for (const [fn, label, args] of OPERATOR_FNS) {
    out[`ext_operator_${fn}`] = modCall(`ext_operator_${fn}`, "operator", fn, `operator.${label}`, args);
  }
  for (const [fn, label, args] of RE_FNS) {
    out[`ext_re_${fn}`] = modCall(`ext_re_${fn}`, "re", fn, `re.${label}`, args);
  }
  for (const [fn, label, args] of COPY_FNS) {
    out[`ext_copy_${fn}`] = modCall(`ext_copy_${fn}`, "copy", fn, `copy.${label}`, args);
  }
  for (const [fn, label, args] of TIME_FNS) {
    out[`ext_time_${fn}`] = modCall(`ext_time_${fn}`, "time", fn, `time.${label}`, args);
  }
  for (const [name, label, res] of STRING_CONST) {
    out[`ext_string_${name}`] = modConst(`ext_string_${name}`, "string", name, `string.${label}`, res);
  }

  // os.path
  const osPath: Array<[string, string, ArgSpec[]]> = [
    ["join", "join(a,b)", [{ name: "a", default: '"data"' }, { name: "b", default: '"map.txt"' }]],
    ["exists", "exists(path)", [{ name: "path", default: '"save.json"' }]],
    ["basename", "basename(path)", [{ name: "path", default: '"data/map.txt"' }]],
    ["dirname", "dirname(path)", [{ name: "path", default: '"data/map.txt"' }]],
    ["splitext", "splitext(path)", [{ name: "path", default: '"sprite.png"' }]],
  ];
  for (const [fn, label, args] of osPath) {
    out[`ext_ospath_${fn}`] = modCall(`ext_ospath_${fn}`, "os.path", fn, `os.path.${label}`, args);
  }

  // cmath — 실수 기반 (교육용)
  for (const [fn, label, def] of MATH_UNARY) {
    out[`ext_cmath_${fn}`] = modCall(`ext_cmath_${fn}`, "cmath", fn, `cmath.${label}`, [{ name: "z", default: def }]);
  }

  // datetime
  out.ext_datetime_now = modCall(
    "ext_datetime_now", "datetime", "now", "datetime.now()",
    [], "{result} = datetime.datetime.now().isoformat()",
  );

  // decimal / fractions
  out.ext_decimal_decimal = modCall(
    "ext_decimal_decimal", "decimal", "Decimal", "Decimal(s)",
    [{ name: "s", default: '"3.14"' }],
  );
  out.ext_fractions_fraction = modCall(
    "ext_fractions_fraction", "fractions", "Fraction", "Fraction(n,d)",
    [{ name: "n", default: "1" }, { name: "d", default: "2" }],
  );

  // collections
  out.ext_collections_counter = modCall(
    "ext_collections_counter", "collections", "Counter", "Counter(iter)",
    [{ name: "data", default: "party", width: 80 }],
    "{result} = dict(collections.Counter({data}))",
  );

  // heapq
  out.ext_heapq_heappush = modVoid("ext_heapq_heappush", "heapq", "heappush", "heapq.heappush(h,x)", [
    { name: "h", default: "heap" }, { name: "x", default: "3" },
  ]);
  out.ext_heapq_heappop = modCall("ext_heapq_heappop", "heapq", "heappop", "heapq.heappop(h)", [
    { name: "h", default: "heap" },
  ]);
  out.ext_heapq_heapify = modVoid("ext_heapq_heapify", "heapq", "heapify", "heapq.heapify(h)", [
    { name: "h", default: "heap" },
  ]);

  // bisect
  out.ext_bisect_bisect_left = modCall("ext_bisect_bisect_left", "bisect", "bisect_left", "bisect.bisect_left(a,x)", [
    { name: "a", default: "sorted_nums" }, { name: "x", default: "2" },
  ]);
  out.ext_bisect_bisect_right = modCall("ext_bisect_bisect_right", "bisect", "bisect_right", "bisect.bisect_right(a,x)", [
    { name: "a", default: "sorted_nums" }, { name: "x", default: "2" },
  ]);
  out.ext_bisect_insort = modVoid("ext_bisect_insort", "bisect", "insort", "bisect.insort(a,x)", [
    { name: "a", default: "sorted_nums" }, { name: "x", default: "2" },
  ]);

  return out;
}

export const STDLIB_BLOCK_DEFS = buildStdlibBlocks();

export const STDLIB_ALIASES: Record<string, string> = {
  random: "ext_import_random",
  math: "ext_import_math",
  statistics: "ext_import_statistics",
  json: "ext_import_json",
  randint: "ext_random_randint",
};

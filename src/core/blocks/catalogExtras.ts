/** 확장 블록 정의 — 형변환·타입·비교·인덱스·내장함수 */

const OP = "#508cdc";
const BUILTIN = "#7890a8";
const CTRL = "#c850a0";
const LOOP = "#48a050";
const STR = "#50a878";
const LIST = "#dc5050";

const builtin1 = (
  id: string,
  fn: string,
  label: string,
  valueDefault = "x",
) => ({
  id,
  category: "builtin",
  label,
  shape: "stack",
  slots: [
    { name: "result", kind: "var", default: "result", width: 72 },
    { name: "value", kind: "expr", default: valueDefault, width: 80 },
  ],
  color: BUILTIN,
  code: `{result} = ${fn}({value})`,
  ui: { type: "builtin", fn, args: ["value"], result: "result" },
});

const builtin2 = (
  id: string,
  fn: string,
  label: string,
) => ({
  id,
  category: "builtin",
  label,
  shape: "stack",
  slots: [
    { name: "result", kind: "var", default: "result", width: 72 },
    { name: "a", kind: "expr", default: "a", width: 56 },
    { name: "b", kind: "expr", default: "b", width: 56 },
  ],
  color: BUILTIN,
  code: `{result} = ${fn}({a}, {b})`,
  ui: { type: "builtin", fn, args: ["a", "b"], result: "result" },
});

const compare = (id: string, op: string) => ({
  id,
  category: "operator",
  label: op,
  shape: "reporter",
  slots: [
    { name: "a", kind: "expr", default: "a", width: 72 },
    { name: "b", kind: "expr", default: "b", width: 72 },
  ],
  color: OP,
  code: `# {a} ${op} {b}`,
  ui: { type: "compare", op, left: "a", right: "b" },
});

export const EXTRA_BLOCK_DEFS = {
  // ── 비교·논리 (reporter) ──
  compare_lt: compare("compare_lt", "<"),
  compare_gte: compare("compare_gte", ">="),
  compare_ne: compare("compare_ne", "!="),
  bool_or: {
    id: "bool_or",
    category: "operator",
    label: "or",
    shape: "reporter",
    slots: [
      { name: "a", kind: "expr", default: "a", width: 72 },
      { name: "b", kind: "expr", default: "b", width: 72 },
    ],
    color: OP,
    code: "# {a} or {b}",
    ui: { type: "compare", op: "or", left: "a", right: "b" },
  },
  bool_not: {
    id: "bool_not",
    category: "operator",
    label: "not",
    shape: "reporter",
    slots: [{ name: "a", kind: "expr", default: "flag", width: 100 }],
    color: OP,
    code: "# not {a}",
    ui: { type: "compare", op: "not", left: "a" },
  },

  // ── 형변환·타입 (technical.md 허용 builtin) ──
  builtin_float: builtin1("builtin_float", "float", "float()", '"3.14"'),
  builtin_bool: builtin1("builtin_bool", "bool", "bool()", "hp"),
  builtin_abs: builtin1("builtin_abs", "abs", "abs()", "damage"),
  builtin_ord: builtin1("builtin_ord", "ord", "ord()", '"A"'),
  builtin_chr: builtin1("builtin_chr", "chr", "chr()", "65"),
  builtin_type: builtin1("builtin_type", "type", "type()", "value"),
  builtin_sum: builtin1("builtin_sum", "sum", "sum()", "party"),
  builtin_sorted: builtin1("builtin_sorted", "sorted", "sorted()", "party"),
  builtin_min: builtin2("builtin_min", "min", "min()"),
  builtin_max: builtin2("builtin_max", "max", "max()"),
  builtin_round: {
    id: "builtin_round",
    category: "builtin",
    label: "round()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "rounded", width: 72 },
      { name: "value", kind: "expr", default: "catch_rate", width: 72 },
      { name: "digits", kind: "expr", default: "", width: 40 },
    ],
    color: BUILTIN,
    code: "{result} = round({value})",
    ui: { type: "builtin", fn: "round", args: ["value", "digits"], result: "result" },
  },
  builtin_isinstance: {
    id: "builtin_isinstance",
    category: "builtin",
    label: "isinstance()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "ok", width: 72 },
      { name: "value", kind: "expr", default: "value", width: 72 },
      { name: "type_name", kind: "expr", default: "int", width: 56 },
    ],
    color: BUILTIN,
    code: "{result} = isinstance({value}, {type_name})",
    ui: { type: "builtin", fn: "isinstance", args: ["value", "type_name"], result: "result" },
  },
  builtin_range_from: {
    id: "builtin_range_from",
    category: "builtin",
    label: "range(a,b)",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "nums", width: 72 },
      { name: "start", kind: "expr", default: "0", width: 40 },
      { name: "stop", kind: "expr", default: "5", width: 40 },
    ],
    color: BUILTIN,
    code: "{result} = list(range({start}, {stop}))",
    ui: { type: "builtin", fn: "range", args: ["start", "stop"], result: "result" },
  },

  // ── 인덱스·슬라이스 (collection.md) ──
  subscript_get: {
    id: "subscript_get",
    category: "list",
    label: "[i] 읽기",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "item", width: 72 },
      { name: "var", kind: "expr", default: "party", width: 72 },
      { name: "index", kind: "expr", default: "0", width: 40 },
    ],
    color: LIST,
    code: "{result} = {var}[{index}]",
    ui: { type: "subscript_get", result: "result", target: "var", index: "index" },
  },
  str_slice: {
    id: "str_slice",
    category: "str",
    label: "[시작:끝]",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "part", width: 72 },
      { name: "var", kind: "expr", default: "name", width: 72 },
      { name: "start", kind: "expr", default: "0", width: 36 },
      { name: "stop", kind: "expr", default: "3", width: 36 },
    ],
    color: STR,
    code: "{result} = {var}[{start}:{stop}]",
    ui: { type: "str_slice", result: "result", target: "var", start: "start", stop: "stop" },
  },
  str_startswith: {
    id: "str_startswith",
    category: "str",
    label: ".startswith()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "ok", width: 72 },
      { name: "var", kind: "expr", default: "name", width: 72 },
      { name: "prefix", kind: "expr", default: '"피"', width: 56 },
    ],
    color: STR,
    code: "{result} = {var}.startswith({prefix})",
    ui: { type: "store_method", result: "result", method: "startswith", args: ["prefix"] },
  },
  str_endswith: {
    id: "str_endswith",
    category: "str",
    label: ".endswith()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "ok", width: 72 },
      { name: "var", kind: "expr", default: "name", width: 72 },
      { name: "suffix", kind: "expr", default: '"츄"', width: 56 },
    ],
    color: STR,
    code: "{result} = {var}.endswith({suffix})",
    ui: { type: "store_method", result: "result", method: "endswith", args: ["suffix"] },
  },
  str_find: {
    id: "str_find",
    category: "str",
    label: ".find()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "pos", width: 72 },
      { name: "var", kind: "expr", default: "text", width: 72 },
      { name: "sub", kind: "expr", default: '"몬"', width: 56 },
    ],
    color: STR,
    code: "{result} = {var}.find({sub})",
    ui: { type: "store_method", result: "result", method: "find", args: ["sub"] },
  },

  // ── 연산·제어 ──
  operator_floordiv: {
    id: "operator_floordiv",
    category: "operator",
    label: "//",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "quotient", width: 72 },
      { name: "a", kind: "expr", default: "hp", width: 48 },
      { name: "b", kind: "expr", default: "2", width: 48 },
    ],
    color: OP,
    code: "{result} = {a} // {b}",
    ui: { type: "operator", op: "//" },
  },
  pass_stmt: {
    id: "pass_stmt",
    category: "control",
    label: "pass",
    shape: "stack",
    slots: [],
    color: CTRL,
    code: "pass",
    ui: { type: "keyword", keyword: "pass" },
  },
  for_range_from: {
    id: "for_range_from",
    category: "control",
    label: "for range(a,b)",
    shape: "c_block",
    hasElse: false,
    slots: [
      { name: "var", kind: "var", default: "i", width: 40 },
      { name: "start", kind: "expr", default: "0", width: 40 },
      { name: "stop", kind: "expr", default: "5", width: 40 },
    ],
    color: LOOP,
    code: "",
    ui: { type: "for_range_from", varSlot: "var", startSlot: "start", stopSlot: "stop" },
  },
};

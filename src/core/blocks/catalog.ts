/** 블록 정의 — Python src/blocks/catalog.py 와 동일 ID */

import type { BlockUi } from "./blockUi";
import type { BlockSpec, WorkspaceBlock } from "./types";
import { EXTRA_BLOCK_DEFS } from "./catalogExtras";
import { EXTENDED_ALIASES, EXTENDED_BLOCK_DEFS } from "./catalogExtended";
import { STDLIB_ALIASES, STDLIB_BLOCK_DEFS } from "./catalogStdlib";

export type { BlockScript, BlockSpec, WorkspaceBlock } from "./types";
export type { BlockUi } from "./blockUi";

export interface SlotDef {
  name: string;
  kind: "text" | "expr" | "bool" | "var" | "func" | "params" | "args";
  default: string;
  width?: number;
}

export interface BlockDef {
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

export interface CategoryMeta {
  id: string;
  label: string;
  color: string;
  order: number;
}

/** 스크래치식 팔레트 카테고리 */
export const BLOCK_CATEGORIES: CategoryMeta[] = [
  { id: "my_blocks", label: "내 블록", color: "#c850c8", order: 0 },
  { id: "print", label: "동작", color: "#e6a020", order: 1 },
  { id: "variable", label: "변수", color: "#e87830", order: 2 },
  { id: "operator", label: "연산", color: "#508cdc", order: 3 },
  { id: "control", label: "제어", color: "#c850a0", order: 4 },
  { id: "builtin", label: "내장", color: "#7890a8", order: 5 },
  { id: "str", label: "문자열", color: "#50a878", order: 6 },
  { id: "dict", label: "딕셔너리", color: "#a07850", order: 7 },
  { id: "list", label: "리스트", color: "#dc5050", order: 8 },
  { id: "function", label: "함수", color: "#6868c8", order: 9 },
  { id: "misc_00", label: "기타-00", color: "#8a8a9a", order: 10 },
  { id: "ext_stdlib", label: "확장-모듈", color: "#6888a8", order: 11 },
];

const LIST = "#dc5050";
const DICT = "#a07850";
const STR = "#50a878";
const OP = "#508cdc";
const VAR = "#e87830";
const PRINT = "#e6a020";
const CTRL = "#c850a0";
const BUILTIN = "#7890a8";
const FUNC = "#6868c8";
const LOOP = "#48a050";

const BLOCKS: Record<string, BlockDef> = {
  print: {
    id: "print",
    category: "print",
    label: "print()",
    shape: "stack",
    slots: [{ name: "value", kind: "expr", default: "", width: 180 }],
    color: PRINT,
    code: "print({value})",
    ui: { type: "print" },
  },
  input_stmt: {
    id: "input_stmt",
    category: "print",
    label: "input()",
    shape: "stack",
    slots: [
      { name: "name", kind: "var", default: "", width: 88 },
      { name: "prompt", kind: "expr", default: "", width: 140 },
    ],
    color: PRINT,
    code: "{name} = input({prompt})",
    ui: { type: "input_kw", nameSlot: "name", promptSlot: "prompt" },
  },
  var_set: {
    id: "var_set",
    category: "variable",
    label: "변수 = 값",
    shape: "stack",
    slots: [
      { name: "name", kind: "var", default: "", width: 88 },
      { name: "value", kind: "expr", default: "", width: 100 },
    ],
    color: VAR,
    code: "{name} = {value}",
    ui: { type: "assign", left: "name", right: "value" },
  },

  operator_add: {
    id: "operator_add",
    category: "operator",
    label: "+",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "a", kind: "expr", default: "", width: 48 },
      { name: "b", kind: "expr", default: "", width: 48 },
    ],
    color: OP,
    code: "{result} = {a} + {b}",
    ui: { type: "operator", op: "+" },
  },
  operator_sub: {
    id: "operator_sub",
    category: "operator",
    label: "-",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "a", kind: "expr", default: "", width: 48 },
      { name: "b", kind: "expr", default: "", width: 48 },
    ],
    color: OP,
    code: "{result} = {a} - {b}",
    ui: { type: "operator", op: "-" },
  },
  operator_mul: {
    id: "operator_mul",
    category: "operator",
    label: "×",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "a", kind: "expr", default: "", width: 48 },
      { name: "b", kind: "expr", default: "", width: 48 },
    ],
    color: OP,
    code: "{result} = {a} * {b}",
    ui: { type: "operator", op: "×" },
  },
  operator_div: {
    id: "operator_div",
    category: "operator",
    label: "÷",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "a", kind: "expr", default: "", width: 48 },
      { name: "b", kind: "expr", default: "", width: 48 },
    ],
    color: OP,
    code: "{result} = {a} / {b}",
    ui: { type: "operator", op: "÷" },
  },
  operator_mod: {
    id: "operator_mod",
    category: "operator",
    label: "%",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "a", kind: "expr", default: "", width: 48 },
      { name: "b", kind: "expr", default: "", width: 48 },
    ],
    color: OP,
    code: "{result} = {a} % {b}",
    ui: { type: "operator", op: "%" },
  },
  operator_pow: {
    id: "operator_pow",
    category: "operator",
    label: "**",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "a", kind: "expr", default: "", width: 48 },
      { name: "b", kind: "expr", default: "", width: 48 },
    ],
    color: OP,
    code: "{result} = {a} ** {b}",
    ui: { type: "operator", op: "**" },
  },

  if: {
    id: "if",
    category: "control",
    label: "if",
    shape: "c_block",
    hasElse: false,
    slots: [{ name: "cond", kind: "bool", default: "", width: 160 }],
    color: CTRL,
    code: "",
    ui: { type: "c_header", keyword: "if", condSlot: "cond" },
  },
  if_else: {
    id: "if_else",
    category: "control",
    label: "if / else",
    shape: "c_block",
    hasElse: true,
    slots: [{ name: "cond", kind: "bool", default: "", width: 200 }],
    color: CTRL,
    code: "",
    ui: { type: "c_header", keyword: "if", condSlot: "cond" },
  },
  elif: {
    id: "elif",
    category: "control",
    label: "elif",
    shape: "c_block",
    hasElse: false,
    slots: [{ name: "cond", kind: "bool", default: "", width: 160 }],
    color: CTRL,
    code: "",
    ui: { type: "c_header", keyword: "elif", condSlot: "cond" },
  },
  else: {
    id: "else",
    category: "control",
    label: "else",
    shape: "c_block",
    hasElse: false,
    slots: [],
    color: CTRL,
    code: "",
    ui: { type: "c_header", keyword: "else" },
  },
  while_loop: {
    id: "while_loop",
    category: "control",
    label: "while",
    shape: "c_block",
    hasElse: false,
    slots: [{ name: "cond", kind: "bool", default: "", width: 140 }],
    color: LOOP,
    code: "",
    ui: { type: "c_header", keyword: "while", condSlot: "cond" },
  },
  for_range: {
    id: "for_range",
    category: "control",
    label: "for range",
    shape: "c_block",
    hasElse: false,
    slots: [
      { name: "var", kind: "var", default: "", width: 40 },
      { name: "stop", kind: "expr", default: "", width: 40 },
    ],
    color: LOOP,
    code: "",
    ui: { type: "c_header", keyword: "for", extraSlots: ["var", "stop"] },
  },
  break_loop: {
    id: "break_loop",
    category: "control",
    label: "break",
    shape: "stack",
    slots: [],
    color: LOOP,
    code: "break",
    ui: { type: "keyword", keyword: "break" },
  },

  def_func: {
    id: "def_func",
    category: "function",
    label: "def",
    shape: "c_block",
    hasElse: false,
    slots: [
      { name: "name", kind: "func", default: "", width: 88 },
      { name: "params", kind: "params", default: "", width: 120 },
    ],
    color: FUNC,
    code: "",
    ui: { type: "c_header", keyword: "def", extraSlots: ["name", "params"] },
  },
  func_call: {
    id: "func_call",
    category: "my_blocks",
    label: "호출",
    shape: "stack",
    slots: [
      { name: "name", kind: "func", default: "", width: 88 },
      { name: "args", kind: "args", default: "", width: 120 },
    ],
    color: FUNC,
    code: "{name}({args})",
    ui: { type: "func_call", nameSlot: "name", argsSlot: "args" },
  },
  func_return: {
    id: "func_return",
    category: "function",
    label: "return",
    shape: "stack",
    slots: [{ name: "value", kind: "expr", default: "", width: 80 }],
    color: FUNC,
    code: "return {value}",
    ui: { type: "return_kw", valueSlot: "value" },
  },
  import_stmt: {
    id: "import_stmt",
    category: "function",
    label: "import",
    shape: "stack",
    slots: [{ name: "module", kind: "expr", default: "", width: 100 }],
    color: FUNC,
    code: "import {module}",
    ui: { type: "import_kw", moduleSlot: "module" },
  },

  compare_eq: {
    id: "compare_eq",
    category: "operator",
    label: "==",
    shape: "reporter",
    slots: [
      { name: "a", kind: "expr", default: "", width: 72 },
      { name: "b", kind: "expr", default: "", width: 72 },
    ],
    color: OP,
    code: "# {a} == {b}",
    ui: { type: "compare", op: "==", left: "a", right: "b" },
  },
  compare_gt: {
    id: "compare_gt",
    category: "operator",
    label: ">",
    shape: "reporter",
    slots: [
      { name: "a", kind: "expr", default: "", width: 72 },
      { name: "b", kind: "expr", default: "", width: 72 },
    ],
    color: OP,
    code: "# {a} > {b}",
    ui: { type: "compare", op: ">", left: "a", right: "b" },
  },
  compare_lte: {
    id: "compare_lte",
    category: "operator",
    label: "<=",
    shape: "reporter",
    slots: [
      { name: "a", kind: "expr", default: "", width: 72 },
      { name: "b", kind: "expr", default: "", width: 72 },
    ],
    color: OP,
    code: "# {a} <= {b}",
    ui: { type: "compare", op: "<=", left: "a", right: "b" },
  },
  bool_and: {
    id: "bool_and",
    category: "operator",
    label: "and",
    shape: "reporter",
    slots: [
      { name: "a", kind: "expr", default: "", width: 72 },
      { name: "b", kind: "expr", default: "", width: 72 },
    ],
    color: OP,
    code: "# {a} and {b}",
    ui: { type: "compare", op: "and", left: "a", right: "b" },
  },

  builtin_len: {
    id: "builtin_len",
    category: "builtin",
    label: "len()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "var", kind: "expr", default: "", width: 80 },
    ],
    color: BUILTIN,
    code: "{result} = len({var})",
    ui: { type: "builtin", fn: "len", args: ["var"], result: "result" },
  },
  builtin_int: {
    id: "builtin_int",
    category: "builtin",
    label: "int()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "value", kind: "expr", default: "", width: 80 },
    ],
    color: BUILTIN,
    code: "{result} = int({value})",
    ui: { type: "builtin", fn: "int", args: ["value"], result: "result" },
  },
  builtin_str: {
    id: "builtin_str",
    category: "builtin",
    label: "str()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "value", kind: "expr", default: "", width: 80 },
    ],
    color: BUILTIN,
    code: "{result} = str({value})",
    ui: { type: "builtin", fn: "str", args: ["value"], result: "result" },
  },
  builtin_range: {
    id: "builtin_range",
    category: "builtin",
    label: "range()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "stop", kind: "expr", default: "", width: 48 },
    ],
    color: BUILTIN,
    code: "{result} = list(range({stop}))",
    ui: { type: "builtin", fn: "range", args: ["stop"], result: "result" },
  },

  str_upper: {
    id: "str_upper",
    category: "str",
    label: ".upper()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "var", kind: "expr", default: "", width: 72 },
    ],
    color: STR,
    code: "{result} = {var}.upper()",
    ui: { type: "store_method", result: "result", method: "upper", args: [] },
  },
  str_lower: {
    id: "str_lower",
    category: "str",
    label: ".lower()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "var", kind: "expr", default: "", width: 72 },
    ],
    color: STR,
    code: "{result} = {var}.lower()",
    ui: { type: "store_method", result: "result", method: "lower", args: [] },
  },
  str_strip: {
    id: "str_strip",
    category: "str",
    label: ".strip()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "var", kind: "expr", default: "", width: 72 },
    ],
    color: STR,
    code: "{result} = {var}.strip()",
    ui: { type: "store_method", result: "result", method: "strip", args: [] },
  },
  str_split: {
    id: "str_split",
    category: "str",
    label: ".split()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "var", kind: "expr", default: "", width: 72 },
      { name: "sep", kind: "expr", default: "", width: 48 },
    ],
    color: STR,
    code: "{result} = {var}.split({sep})",
    ui: { type: "store_method", result: "result", method: "split", args: ["sep"] },
  },
  str_join: {
    id: "str_join",
    category: "str",
    label: ".join()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "sep", kind: "expr", default: "", width: 56 },
      { name: "var", kind: "expr", default: "", width: 72 },
    ],
    color: STR,
    code: "{result} = {sep}.join({var})",
    ui: { type: "join", sep: "sep", items: "var", result: "result" },
  },
  str_replace: {
    id: "str_replace",
    category: "str",
    label: ".replace()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "var", kind: "expr", default: "", width: 72 },
      { name: "old", kind: "expr", default: "", width: 72 },
      { name: "new", kind: "expr", default: "", width: 72 },
    ],
    color: STR,
    code: "{result} = {var}.replace({old}, {new})",
    ui: { type: "store_method", result: "result", method: "replace", args: ["old", "new"] },
  },

  dict_empty: {
    id: "dict_empty",
    category: "dict",
    label: "{ ... }",
    shape: "stack",
    slots: [
      { name: "var", kind: "var", default: "", width: 72 },
      { name: "body", kind: "expr", default: "", width: 160 },
    ],
    color: DICT,
    code: "{var} = {body}",
    ui: { type: "dict_init" },
  },
  dict_set: {
    id: "dict_set",
    category: "dict",
    label: "dict 리터럴",
    shape: "stack",
    slots: [
      { name: "var", kind: "var", default: "", width: 72 },
      { name: "body", kind: "expr", default: "", width: 200 },
    ],
    color: DICT,
    code: "{var} = {body}",
    ui: { type: "dict_literal" },
  },
  dict_set_item: {
    id: "dict_set_item",
    category: "dict",
    label: "[key] =",
    shape: "stack",
    slots: [
      { name: "var", kind: "var", default: "", width: 72 },
      { name: "key", kind: "expr", default: "", width: 56 },
      { name: "value", kind: "expr", default: "", width: 56 },
    ],
    color: DICT,
    code: "{var}[{key}] = {value}",
    ui: { type: "subscript_set", key: "key", value: "value" },
  },
  dict_get: {
    id: "dict_get",
    category: "dict",
    label: ".get()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "var", kind: "expr", default: "", width: 72 },
      { name: "key", kind: "expr", default: "", width: 56 },
      { name: "default", kind: "expr", default: "", width: 56 },
    ],
    color: DICT,
    code: "{result} = {var}.get({key}, {default})",
    ui: { type: "store_method", result: "result", method: "get", args: ["key", "default"] },
  },
  dict_pop: {
    id: "dict_pop",
    category: "dict",
    label: ".pop()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "var", kind: "expr", default: "", width: 72 },
      { name: "key", kind: "expr", default: "", width: 56 },
    ],
    color: DICT,
    code: "{result} = {var}.pop({key})",
    ui: { type: "store_method", result: "result", method: "pop", args: ["key"] },
  },
  dict_update: {
    id: "dict_update",
    category: "dict",
    label: ".update()",
    shape: "stack",
    slots: [
      { name: "var", kind: "var", default: "", width: 72 },
      { name: "other", kind: "expr", default: "", width: 120 },
    ],
    color: DICT,
    code: "{var}.update({other})",
    ui: { type: "method", method: "update", args: ["other"] },
  },
  dict_clear: {
    id: "dict_clear",
    category: "dict",
    label: ".clear()",
    shape: "stack",
    slots: [{ name: "var", kind: "var", default: "", width: 72 }],
    color: DICT,
    code: "{var}.clear()",
    ui: { type: "method", method: "clear", args: [] },
  },
  dict_keys: {
    id: "dict_keys",
    category: "dict",
    label: ".keys()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "var", kind: "expr", default: "", width: 72 },
    ],
    color: DICT,
    code: "{result} = list({var}.keys())",
    ui: { type: "store_method", result: "result", method: "keys", args: [] },
  },

  list_empty: {
    id: "list_empty",
    category: "list",
    label: "[ ... ]",
    shape: "stack",
    slots: [
      { name: "name", kind: "var", default: "", width: 72 },
      { name: "body", kind: "expr", default: "", width: 160 },
    ],
    color: LIST,
    code: "{name} = {body}",
    ui: { type: "list_init" },
  },
  tuple_init: {
    id: "tuple_init",
    category: "list",
    label: "( ... )",
    shape: "stack",
    slots: [
      { name: "name", kind: "var", default: "", width: 72 },
      { name: "body", kind: "expr", default: "", width: 120 },
    ],
    color: LIST,
    code: "{name} = {body}",
    ui: { type: "tuple_init" },
  },
  list_append: {
    id: "list_append",
    category: "list",
    label: ".append()",
    shape: "stack",
    slots: [
      { name: "var", kind: "var", default: "", width: 72 },
      { name: "value", kind: "expr", default: "", width: 120 },
    ],
    color: LIST,
    code: "{var}.append({value})",
    ui: { type: "method", method: "append", args: ["value"] },
  },
  list_insert: {
    id: "list_insert",
    category: "list",
    label: ".insert()",
    shape: "stack",
    slots: [
      { name: "var", kind: "var", default: "", width: 72 },
      { name: "index", kind: "expr", default: "", width: 40 },
      { name: "value", kind: "expr", default: "", width: 100 },
    ],
    color: LIST,
    code: "{var}.insert({index}, {value})",
    ui: { type: "method", method: "insert", args: ["index", "value"] },
  },
  list_extend: {
    id: "list_extend",
    category: "list",
    label: ".extend()",
    shape: "stack",
    slots: [
      { name: "var", kind: "var", default: "", width: 72 },
      { name: "other", kind: "expr", default: "", width: 72 },
    ],
    color: LIST,
    code: "{var}.extend({other})",
    ui: { type: "method", method: "extend", args: ["other"] },
  },
  list_remove: {
    id: "list_remove",
    category: "list",
    label: ".remove()",
    shape: "stack",
    slots: [
      { name: "var", kind: "var", default: "", width: 72 },
      { name: "value", kind: "expr", default: "", width: 100 },
    ],
    color: LIST,
    code: "{var}.remove({value})",
    ui: { type: "method", method: "remove", args: ["value"] },
  },
  list_pop: {
    id: "list_pop",
    category: "list",
    label: ".pop()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "var", kind: "var", default: "", width: 72 },
    ],
    color: LIST,
    code: "{result} = {var}.pop()",
    ui: { type: "store_method", result: "result", method: "pop", args: [] },
  },
  list_pop_at: {
    id: "list_pop_at",
    category: "list",
    label: ".pop(i)",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "var", kind: "var", default: "", width: 72 },
      { name: "index", kind: "expr", default: "", width: 40 },
    ],
    color: LIST,
    code: "{result} = {var}.pop({index})",
    ui: { type: "store_method", result: "result", method: "pop", args: ["index"] },
  },
  list_clear: {
    id: "list_clear",
    category: "list",
    label: ".clear()",
    shape: "stack",
    slots: [{ name: "var", kind: "var", default: "", width: 72 }],
    color: LIST,
    code: "{var}.clear()",
    ui: { type: "method", method: "clear", args: [] },
  },
  list_sort: {
    id: "list_sort",
    category: "list",
    label: ".sort()",
    shape: "stack",
    slots: [{ name: "var", kind: "var", default: "", width: 72 }],
    color: LIST,
    code: "{var}.sort()",
    ui: { type: "method", method: "sort", args: [] },
  },
  list_reverse: {
    id: "list_reverse",
    category: "list",
    label: ".reverse()",
    shape: "stack",
    slots: [{ name: "var", kind: "var", default: "", width: 72 }],
    color: LIST,
    code: "{var}.reverse()",
    ui: { type: "method", method: "reverse", args: [] },
  },
  list_index: {
    id: "list_index",
    category: "list",
    label: ".index()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "var", kind: "var", default: "", width: 72 },
      { name: "value", kind: "expr", default: "", width: 100 },
    ],
    color: LIST,
    code: "{result} = {var}.index({value})",
    ui: { type: "store_method", result: "result", method: "index", args: ["value"] },
  },
  list_count: {
    id: "list_count",
    category: "list",
    label: ".count()",
    shape: "stack",
    slots: [
      { name: "result", kind: "var", default: "", width: 72 },
      { name: "var", kind: "var", default: "", width: 72 },
      { name: "value", kind: "expr", default: "", width: 100 },
    ],
    color: LIST,
    code: "{result} = {var}.count({value})",
    ui: { type: "store_method", result: "result", method: "count", args: ["value"] },
  },

  ...EXTRA_BLOCK_DEFS as Record<string, BlockDef>,
  ...EXTENDED_BLOCK_DEFS as Record<string, BlockDef>,
  ...STDLIB_BLOCK_DEFS as Record<string, BlockDef>,
};

const ALIASES: Record<string, string> = {
  operator: "operator_sub",
  compare_eq: "compare_eq",
  compare_gt: "compare_gt",
  compare_lt: "compare_lt",
  compare_lte: "compare_lte",
  compare_gte: "compare_gte",
  compare_ne: "compare_ne",
  and: "bool_and",
  or: "bool_or",
  not: "bool_not",
  elif: "elif",
  else: "else",
  for: "for_range",
  for_range: "for_range",
  while: "while_loop",
  def: "def_func",
  import: "import_stmt",
  break: "break_loop",
  pass: "pass_stmt",
  dict: "dict_set",
  list: "list_append",
  list_empty: "list_empty",
  len: "builtin_len",
  int: "builtin_int",
  str: "builtin_str",
  float: "builtin_float",
  bool: "builtin_bool",
  abs: "builtin_abs",
  min: "builtin_min",
  max: "builtin_max",
  round: "builtin_round",
  sum: "builtin_sum",
  sorted: "builtin_sorted",
  type: "builtin_type",
  isinstance: "builtin_isinstance",
  ord: "builtin_ord",
  chr: "builtin_chr",
  input: "input_stmt",
  subscript_get: "subscript_get",
  list_get: "subscript_get",
  ...EXTENDED_ALIASES,
  ...STDLIB_ALIASES,
};

/** 스크래치처럼 빈 슬롯으로 시작하도록 카탈로그의 예시 기본값을 전부 제거한 캐시 */
const blankedDefCache = new Map<BlockDef, BlockDef>();

function withoutSlotDefaults(def: BlockDef): BlockDef {
  let blanked = blankedDefCache.get(def);
  if (!blanked) {
    blanked = { ...def, slots: def.slots.map((s) => ({ ...s, default: "" })) };
    blankedDefCache.set(def, blanked);
  }
  return blanked;
}

export function getBlockDef(id: string): BlockDef | undefined {
  const resolved = ALIASES[id] ?? id;
  const def = BLOCKS[resolved] ?? BLOCKS[id];
  return def ? withoutSlotDefaults(def) : undefined;
}

export function isCBlock(id: string): boolean {
  return getBlockDef(id)?.shape === "c_block";
}

export function isReporterBlock(id: string): boolean {
  return getBlockDef(id)?.shape === "reporter";
}

/** 값·조건 칸에 끼울 수 있는 블록 (둥근 reporter + 표현식 내장/연산 블록) */
const EXPR_NEST_UI = new Set([
  "operator",
  "builtin",
  "store_method",
  "join",
  "subscript_get",
  "str_slice",
  "func_call",
  "mod_call",
  "mod_const",
]);

export function isExprNestBlock(id: string): boolean {
  if (isReporterBlock(id)) return true;
  const ui = getBlockDef(id)?.ui;
  return ui ? EXPR_NEST_UI.has(ui.type) : false;
}

export function allBlockIds(): string[] {
  return Object.keys(BLOCKS);
}

export function paletteByCategory(): Array<CategoryMeta & { ids: string[] }> {
  const grouped = new Map<string, string[]>();
  for (const id of allBlockIds()) {
    const def = BLOCKS[id];
    if (!def) continue;
    const list = grouped.get(def.category) ?? [];
    list.push(id);
    grouped.set(def.category, list);
  }
  return BLOCK_CATEGORIES.filter((c) => grouped.has(c.id)).map((c) => ({
    ...c,
    ids: grouped.get(c.id)!,
  }));
}

export function splitPalette(ids: string[]): { stack: string[]; cBlocks: string[] } {
  const stack: string[] = [];
  const cBlocks: string[] = [];
  for (const id of ids) {
    const def = getBlockDef(id);
    if (!def || def.shape === "reporter") continue;
    if (isCBlock(id)) cBlocks.push(id);
    else stack.push(id);
  }
  return { stack, cBlocks };
}

export function paletteForPuzzle(allowed: string[]): string[] {
  const ids: string[] = [];
  for (const raw of allowed) {
    const bid = ALIASES[raw] ?? raw;
    const def = BLOCKS[bid] ?? BLOCKS[raw];
    const id = def?.id ?? bid;
    if (BLOCKS[id] && !ids.includes(id)) ids.push(id);
  }
  return ids.length ? ids : ["print"];
}

export function grammarToBlocks(grammar: string[]): string[] {
  const mapping: Record<string, string[]> = {
    print: ["print", "input_stmt"],
    variable: ["var_set", "print", "input_stmt", "builtin_int", "builtin_float", "builtin_bool", "builtin_str", "builtin_type"],
    operator: [
      "var_set", "operator_sub", "operator_add", "operator_div", "operator_mul", "operator_mod", "operator_pow",
      "operator_floordiv", "compare_eq", "compare_ne", "compare_gt", "compare_lt", "compare_lte", "compare_gte",
      "bool_and", "bool_or", "bool_not", "builtin_abs", "builtin_min", "builtin_max", "builtin_round",
      "print", "input_stmt",
    ],
    if: [
      "if", "if_else", "elif", "else", "compare_eq", "compare_ne", "compare_lte", "compare_gte", "compare_gt",
      "compare_lt", "bool_and", "bool_or", "bool_not", "builtin_isinstance", "var_set", "print", "input_stmt",
    ],
    else: ["else", "if_else", "print", "input_stmt", "pass_stmt"],
    elif: ["elif", "if", "else", "compare_eq", "compare_ne", "print", "input_stmt"],
    dict: ["dict_empty", "dict_set", "dict_set_item", "dict_get", "subscript_get", "print", "input_stmt"],
    list: [
      "list_empty", "tuple_init", "list_append", "list_insert", "list_extend", "list_remove", "list_pop",
      "list_pop_at", "list_clear", "list_sort", "list_reverse", "list_index", "list_count", "subscript_get",
      "builtin_len", "builtin_sum", "builtin_sorted", "builtin_min", "builtin_max", "print", "input_stmt",
    ],
    for: ["for_range", "for_range_from", "print", "var_set", "break_loop", "pass_stmt", "input_stmt"],
    while: ["while_loop", "if_else", "compare_gt", "compare_lt", "break_loop", "print", "input_stmt", "pass_stmt"],
    str: [
      "var_set", "operator_add", "builtin_str", "str_join", "str_upper", "str_lower", "str_strip", "str_split",
      "str_replace", "str_slice", "str_startswith", "str_endswith", "str_find", "builtin_ord", "builtin_chr",
      "subscript_get", "print", "input_stmt",
    ],
    def: ["def_func", "func_call", "func_return", "print", "var_set", "input_stmt", "pass_stmt"],
    import: ["import_stmt", "if_else", "print", "input_stmt"],
    input: ["input_stmt", "print", "var_set", "builtin_int", "builtin_float"],
  };
  const blocks: string[] = [];
  for (const g of grammar) {
    for (const b of mapping[g] ?? []) {
      if (!blocks.includes(b)) blocks.push(b);
    }
  }
  return blocks.length ? blocks : ["print"];
}

export interface CreateBlockOptions {
  /** 팔레트에서 가져올 때 모든 슬롯을 빈 값으로 */
  empty?: boolean;
}

export function createBlockInstance(id: string, options: CreateBlockOptions = {}): WorkspaceBlock {
  const def = getBlockDef(id);
  if (!def) return { uid: 0, id, slots: {} };
  const slots: Record<string, string> = {};
  for (const s of def.slots) slots[s.name] = options.empty ? "" : s.default;
  const block: WorkspaceBlock = { uid: 0, id: def.id, slots };
  if (def.shape === "c_block") {
    block.body = [];
    if (def.hasElse) block.elseBody = [];
  }
  return block;
}

export function blockFromSpec(spec: BlockSpec, allocUid: () => number): WorkspaceBlock {
  const inst = createBlockInstance(spec.id);
  const block: WorkspaceBlock = {
    uid: allocUid(),
    id: inst.id,
    slots: { ...inst.slots, ...spec.slots },
  };
  const def = getBlockDef(inst.id);
  if (def?.shape === "c_block") {
    block.body = (spec.body ?? []).map((s) => blockFromSpec(s, allocUid));
    const elseSrc = spec.else_body ?? spec.elseBody ?? [];
    if (def.hasElse) {
      block.elseBody = elseSrc.map((s) => blockFromSpec(s, allocUid));
    } else {
      block.elseBody = undefined;
    }
  }
  return block;
}

export function slotValue(def: BlockDef, slots: Record<string, string>, name: string): string {
  const v = slots[name];
  if (v !== undefined && v !== "") return v;
  return def.slots.find((s) => s.name === name)?.default ?? "";
}

export function applyCodeTemplate(def: BlockDef, slots: Record<string, string>): string {
  return def.code.replace(/\{(\w+)\}/g, (_, key) => slotValue(def, slots, key));
}

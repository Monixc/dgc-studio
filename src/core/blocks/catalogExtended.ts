/**
 * 기타-00 확장 블록 — 표준 내장함수·내장 메서드 전체 커버리지
 * 필수(퍼즐·튜토리얼) 블록은 catalog / catalogExtras, 나머지는 여기.
 */

import type { BlockUi } from "./blockUi";

const MISC = "#8a8a9a";

interface SlotDef {
  name: string;
  kind: "text" | "expr" | "bool" | "var";
  default: string;
  width?: number;
}

export interface ExtendedBlockDef {
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

function slot(
  name: string,
  kind: SlotDef["kind"],
  defaultVal: string,
  width?: number,
): SlotDef {
  return { name, kind, default: defaultVal, width };
}

/** result = fn(value) */
function builtin1(
  id: string,
  fn: string,
  label: string,
  valueDefault = "x",
  code?: string,
): ExtendedBlockDef {
  return {
    id,
    category: "misc_00",
    label,
    shape: "stack",
    slots: [
      slot("result", "var", "result", 72),
      slot("value", "expr", valueDefault, 80),
    ],
    color: MISC,
    code: code ?? `{result} = ${fn}({value})`,
    ui: { type: "builtin", fn, args: ["value"], result: "result" },
  };
}

/** result = fn(a, b) */
function builtin2(id: string, fn: string, label: string, code?: string): ExtendedBlockDef {
  return {
    id,
    category: "misc_00",
    label,
    shape: "stack",
    slots: [
      slot("result", "var", "result", 72),
      slot("a", "expr", "a", 56),
      slot("b", "expr", "b", 56),
    ],
    color: MISC,
    code: code ?? `{result} = ${fn}({a}, {b})`,
    ui: { type: "builtin", fn, args: ["a", "b"], result: "result" },
  };
}

/** result = fn(a, b, c) */
function builtin3(id: string, fn: string, label: string, code?: string): ExtendedBlockDef {
  return {
    id,
    category: "misc_00",
    label,
    shape: "stack",
    slots: [
      slot("result", "var", "result", 72),
      slot("a", "expr", "a", 48),
      slot("b", "expr", "b", 48),
      slot("c", "expr", "c", 48),
    ],
    color: MISC,
    code: code ?? `{result} = ${fn}({a}, {b}, {c})`,
    ui: { type: "builtin", fn, args: ["a", "b", "c"], result: "result" },
  };
}

/** target.method(args…) — 반환값 저장 */
function storeMethod(
  id: string,
  method: string,
  label: string,
  args: Array<{ name: string; default: string; width?: number }>,
  code?: string,
  targetDefault = "text",
): ExtendedBlockDef {
  const argNames = args.map((a) => a.name);
  const argSlots = args.map((a) => slot(a.name, "expr", a.default, a.width ?? 56));
  const callArgs = argNames.map((n) => `{${n}}`).join(", ");
  return {
    id,
    category: "misc_00",
    label,
    shape: "stack",
    slots: [slot("result", "var", "result", 72), slot("var", "expr", targetDefault, 72), ...argSlots],
    color: MISC,
    code: code ?? `{result} = {var}.${method}(${callArgs})`,
    ui: { type: "store_method", result: "result", method, args: argNames },
  };
}

/** target.method(args…) — 부수 효과만 */
function voidMethod(
  id: string,
  method: string,
  label: string,
  args: Array<{ name: string; default: string; width?: number }> = [],
  targetKind: "var" | "expr" = "var",
  targetDefault = "party",
): ExtendedBlockDef {
  const argNames = args.map((a) => a.name);
  const argSlots = args.map((a) => slot(a.name, "expr", a.default, a.width ?? 56));
  const callArgs = argNames.map((n) => `{${n}}`).join(", ");
  return {
    id,
    category: "misc_00",
    label,
    shape: "stack",
    slots: [slot("var", targetKind, targetDefault, 72), ...argSlots],
    color: MISC,
    code: `{var}.${method}(${callArgs})`,
    ui: { type: "method", method, args: argNames },
  };
}

/** list(내장뷰) — keys/values/items/enumerate 등 */
function listWrapBuiltin(
  id: string,
  fn: string,
  label: string,
  args: Array<{ name: string; default: string }>,
  inner: string,
): ExtendedBlockDef {
  const argNames = args.map((a) => a.name);
  const argSlots = args.map((a) => slot(a.name, "expr", a.default, 72));
  const callInner = argNames.map((n) => `{${n}}`).join(", ");
  return {
    id,
    category: "misc_00",
    label,
    shape: "stack",
    slots: [slot("result", "var", "result", 72), ...argSlots],
    color: MISC,
    code: `{result} = list(${inner})`,
    ui: { type: "builtin", fn, args: argNames, result: "result" },
  };
}

function dictListView(id: string, method: string, label: string): ExtendedBlockDef {
  return storeMethod(id, method, label, [], `{result} = list({var}.${method}())`, "pokemon");
}

// ── 내장 함수 (builtin) ─────────────────────────────────────────────

const BUILTIN_UNARY: Array<[string, string, string, string?, string?]> = [
  ["misc_all", "all", "all()", "party"],
  ["misc_any", "any", "any()", "party"],
  ["misc_ascii", "ascii", "ascii()", '"포켓몬"'],
  ["misc_bin", "bin", "bin()", "42"],
  ["misc_bool_fn", "bool", "bool()", "hp"],
  ["misc_bytearray", "bytearray", "bytearray()", 'b""'],
  ["misc_bytes", "bytes", "bytes()", '"hi"'],
  ["misc_callable", "callable", "callable()", "attack"],
  ["misc_chr_fn", "chr", "chr()", "65"],
  ["misc_complex", "complex", "complex()", '"1+2j"'],
  ["misc_dict_fn", "dict", "dict()", "other"],
  ["misc_float_fn", "float", "float()", '"3.14"'],
  ["misc_frozenset", "frozenset", "frozenset()", "party"],
  ["misc_hash", "hash", "hash()", "name"],
  ["misc_hex", "hex", "hex()", "255"],
  ["misc_id", "id", "id()", "value"],
  ["misc_int_fn", "int", "int()", '"42"'],
  ["misc_iter", "iter", "iter()", "party"],
  ["misc_len_fn", "len", "len()", "party"],
  ["misc_list_fn", "list", "list()", "party"],
  ["misc_oct", "oct", "oct()", "255"],
  ["misc_ord_fn", "ord", "ord()", '"A"'],
  ["misc_repr", "repr", "repr()", "value"],
  ["misc_reversed", "reversed", "reversed()", "party", "{result} = list(reversed({value}))"],
  ["misc_set_fn", "set", "set()", "party"],
  ["misc_str_fn", "str", "str()", "hp"],
  ["misc_sum_fn", "sum", "sum()", "party"],
  ["misc_tuple_fn", "tuple", "tuple()", "party"],
  ["misc_type_fn", "type", "type()", "value"],
  ["misc_object", "object", "object()", "value"],
  ["misc_dir", "dir", "dir()", "pokemon", "{result} = list(dir({value}))"],
];

const BUILTIN_BINARY: Array<[string, string, string, string?]> = [
  ["misc_divmod", "divmod", "divmod()"],
  ["misc_format", "format", "format()", "{result} = format({a}, {b})"],
  ["misc_getattr", "getattr", "getattr()", "{result} = getattr({a}, {b})"],
  ["misc_hasattr", "hasattr", "hasattr()", "{result} = hasattr({a}, {b})"],
  ["misc_isinstance_fn", "isinstance", "isinstance()"],
  ["misc_issubclass", "issubclass", "issubclass()"],
  ["misc_map", "map", "map()", "{result} = list(map({a}, {b}))"],
  ["misc_max_fn", "max", "max()"],
  ["misc_min_fn", "min", "min()"],
  ["misc_next", "next", "next()"],
  ["misc_pow", "pow", "pow()"],
  ["misc_round_fn", "round", "round()"],
  ["misc_sorted_fn", "sorted", "sorted()", "{result} = sorted({a})"],
  ["misc_zip", "zip", "zip()", "{result} = list(zip({a}, {b}))"],
];

const BUILTIN_TERNARY: Array<[string, string, string, string?]> = [
  ["misc_filter", "filter", "filter()", "{result} = list(filter({a}, {b}))"],
  ["misc_getattr_def", "getattr", "getattr(d)", "{result} = getattr({a}, {b}, {c})"],
  ["misc_pow_mod", "pow", "pow(a,b,mod)", "{result} = pow({a}, {b}, {c})"],
  ["misc_range_step", "range", "range(a,b,s)", "{result} = list(range({a}, {b}, {c}))"],
  ["misc_slice", "slice", "slice(a,b)", "{result} = slice({a}, {b}, {c})"],
];

const BUILTIN_LIST_WRAP: Array<[string, string, string, Array<{ name: string; default: string }>, string]> = [
  ["misc_enumerate", "enumerate", "enumerate()", [{ name: "value", default: "party" }], "enumerate({value})"],
  [
    "misc_enumerate_start",
    "enumerate",
    "enumerate(s)",
    [
      { name: "value", default: "party" },
      { name: "start", default: "0" },
    ],
    "enumerate({value}, {start})",
  ],
];

// ── str 메서드 (미포함분) ───────────────────────────────────────────

const STR_METHOD_0: Array<[string, string]> = [
  ["misc_str_capitalize", "capitalize"],
  ["misc_str_casefold", "casefold"],
  ["misc_str_swapcase", "swapcase"],
  ["misc_str_title", "title"],
  ["misc_str_isalpha", "isalpha"],
  ["misc_str_isalnum", "isalnum"],
  ["misc_str_isascii", "isascii"],
  ["misc_str_isdecimal", "isdecimal"],
  ["misc_str_isdigit", "isdigit"],
  ["misc_str_isidentifier", "isidentifier"],
  ["misc_str_islower", "islower"],
  ["misc_str_isnumeric", "isnumeric"],
  ["misc_str_isprintable", "isprintable"],
  ["misc_str_isspace", "isspace"],
  ["misc_str_istitle", "istitle"],
  ["misc_str_isupper", "isupper"],
];

const STR_METHOD_1: Array<[string, string, string, string]> = [
  ["misc_str_center", "center", "width", "10"],
  ["misc_str_ljust", "ljust", "width", "10"],
  ["misc_str_rjust", "rjust", "width", "10"],
  ["misc_str_zfill", "zfill", "width", "5"],
  ["misc_str_removeprefix", "removeprefix", "prefix", '"포"'],
  ["misc_str_removesuffix", "removesuffix", "suffix", '"츄"'],
  ["misc_str_lstrip", "lstrip", "chars", '""'],
  ["misc_str_rstrip", "rstrip", "chars", '""'],
  ["misc_str_strip_chars", "strip", "chars", '""'],
  ["misc_str_count", "count", "sub", '"몬"'],
  ["misc_str_find_r", "rfind", "sub", '"몬"'],
  ["misc_str_index", "index", "sub", '"몬"'],
  ["misc_str_rindex", "rindex", "sub", '"몬"'],
  ["misc_str_format", "format", "arg", "name"],
  ["misc_str_rsplit", "rsplit", "sep", '","'],
];

const STR_METHOD_2: Array<[string, string, string, string]> = [
  ["misc_str_partition", "partition", "sep", '","'],
  ["misc_str_rpartition", "rpartition", "sep", '","'],
  ["misc_str_splitlines", "splitlines", "keepends", "False"],
  ["misc_str_expandtabs", "expandtabs", "tabsize", "4"],
];

// ── list / dict / set / tuple 메서드 ─────────────────────────────────

const LIST_MISC: Array<[string, string, "store" | "void", Array<{ name: string; default: string }>?]> = [
  ["misc_list_copy", "copy", "store", []],
  ["misc_list_sort_rev", "sort", "void", [{ name: "reverse", default: "True" }]],
];

const DICT_MISC_STORE: Array<[string, string]> = [
  ["misc_dict_values", "values"],
  ["misc_dict_items", "items"],
  ["misc_dict_copy", "copy"],
];

const DICT_MISC_VOID: Array<[string, string, Array<{ name: string; default: string }>]> = [
  ["misc_dict_setdefault", "setdefault", [
    { name: "key", default: '"hp"' },
    { name: "value", default: "0" },
  ]],
  ["misc_dict_popitem", "popitem", []],
];

const DICT_MISC_STORE_ARGS: Array<[string, string, Array<{ name: string; default: string }>]> = [
  ["misc_dict_fromkeys", "fromkeys", [
    { name: "keys", default: '["a", "b"]' },
    { name: "value", default: "0" },
  ]],
];

const SET_VOID: Array<[string, string, Array<{ name: string; default: string }>?]> = [
  ["misc_set_add", "add", [{ name: "value", default: '"피카츄"' }]],
  ["misc_set_remove", "remove", [{ name: "value", default: '"피카츄"' }]],
  ["misc_set_discard", "discard", [{ name: "value", default: '"피카츄"' }]],
  ["misc_set_clear", "clear", []],
  ["misc_set_update", "update", [{ name: "other", default: "box" }]],
];

const SET_STORE: Array<[string, string, Array<{ name: string; default: string }>?]> = [
  ["misc_set_copy", "copy", []],
  ["misc_set_pop", "pop", []],
  ["misc_set_union", "union", [{ name: "other", default: "box" }]],
  ["misc_set_intersection", "intersection", [{ name: "other", default: "box" }]],
  ["misc_set_difference", "difference", [{ name: "other", default: "box" }]],
  ["misc_set_symmetric_difference", "symmetric_difference", [{ name: "other", default: "box" }]],
  ["misc_set_issubset", "issubset", [{ name: "other", default: "box" }]],
  ["misc_set_issuperset", "issuperset", [{ name: "other", default: "box" }]],
  ["misc_set_isdisjoint", "isdisjoint", [{ name: "other", default: "box" }]],
];

const TUPLE_STORE: Array<[string, string, Array<{ name: string; default: string }>]> = [
  ["misc_tuple_count", "count", [{ name: "value", default: '"피카츄"' }]],
  ["misc_tuple_index", "index", [{ name: "value", default: '"피카츄"' }]],
];

// ── 기타 문장 ───────────────────────────────────────────────────────

const MISC_STMTS: ExtendedBlockDef[] = [
  {
    id: "misc_continue",
    category: "misc_00",
    label: "continue",
    shape: "stack",
    slots: [],
    color: MISC,
    code: "continue",
    ui: { type: "keyword", keyword: "continue" },
  },
  {
    id: "misc_del_var",
    category: "misc_00",
    label: "del",
    shape: "stack",
    slots: [slot("name", "var", "temp", 72)],
    color: MISC,
    code: "del {name}",
    ui: { type: "keyword", keyword: "del" },
  },
  {
    id: "misc_del_item",
    category: "misc_00",
    label: "del [i]",
    shape: "stack",
    slots: [
      slot("var", "expr", "party", 72),
      slot("index", "expr", "0", 40),
    ],
    color: MISC,
    code: "del {var}[{index}]",
    ui: { type: "del_sub", target: "var", index: "index" },
  },
  {
    id: "misc_subscript_set",
    category: "misc_00",
    label: "[i] =",
    shape: "stack",
    slots: [
      slot("var", "expr", "party", 72),
      slot("index", "expr", "0", 40),
      slot("value", "expr", '"이상해씨"', 100),
    ],
    color: MISC,
    code: "{var}[{index}] = {value}",
    ui: { type: "subscript_set", key: "index", value: "value" },
  },
  {
    id: "misc_list_literal",
    category: "misc_00",
    label: "list [...]",
    shape: "stack",
    slots: [
      slot("name", "var", "party", 72),
      slot("body", "expr", '["피카츄", "이상해씨"]', 160),
    ],
    color: MISC,
    code: "{name} = {body}",
    ui: { type: "dict_literal" },
  },
  {
    id: "misc_tuple_literal",
    category: "misc_00",
    label: "tuple (...)",
    shape: "stack",
    slots: [
      slot("name", "var", "stats", 72),
      slot("body", "expr", '("hp", 40)', 120),
    ],
    color: MISC,
    code: "{name} = {body}",
    ui: { type: "dict_literal" },
  },
  {
    id: "misc_set_literal",
    category: "misc_00",
    label: "set {...}",
    shape: "stack",
    slots: [
      slot("name", "var", "types", 72),
      slot("body", "expr", '{"풀", "불"}', 120),
    ],
    color: MISC,
    code: "{name} = {body}",
    ui: { type: "dict_literal" },
  },
  {
    id: "misc_assert",
    category: "misc_00",
    label: "assert",
    shape: "stack",
    slots: [slot("cond", "bool", "hp > 0", 140)],
    color: MISC,
    code: "assert {cond}",
    ui: { type: "c_header", keyword: "assert", condSlot: "cond" },
  },
  {
    id: "misc_from_import",
    category: "misc_00",
    label: "from … import",
    shape: "stack",
    slots: [
      slot("module", "expr", "random", 80),
      slot("name", "expr", "randint", 80),
    ],
    color: MISC,
    code: "from {module} import {name}",
    ui: { type: "from_import", moduleSlot: "module", nameSlot: "name" },
  },
  {
    id: "misc_setattr",
    category: "misc_00",
    label: "setattr()",
    shape: "stack",
    slots: [
      slot("obj", "expr", "pokemon", 72),
      slot("name", "expr", '"hp"', 56),
      slot("value", "expr", "50", 48),
    ],
    color: MISC,
    code: "setattr({obj}, {name}, {value})",
    ui: { type: "void_builtin", fn: "setattr", args: ["obj", "name", "value"] },
  },
  {
    id: "misc_delattr",
    category: "misc_00",
    label: "delattr()",
    shape: "stack",
    slots: [
      slot("obj", "expr", "pokemon", 72),
      slot("name", "expr", '"temp"', 56),
    ],
    color: MISC,
    code: "delattr({obj}, {name})",
    ui: { type: "void_builtin", fn: "delattr", args: ["obj", "name"] },
  },
  {
    id: "misc_str_encode",
    category: "misc_00",
    label: ".encode()",
    shape: "stack",
    slots: [
      slot("result", "var", "data", 72),
      slot("var", "expr", "text", 72),
      slot("enc", "expr", '"utf-8"', 56),
    ],
    color: MISC,
    code: "{result} = {var}.encode({enc})",
    ui: { type: "store_method", result: "result", method: "encode", args: ["enc"] },
  },
  {
    id: "misc_bytes_decode",
    category: "misc_00",
    label: "bytes.decode()",
    shape: "stack",
    slots: [
      slot("result", "var", "text", 72),
      slot("var", "expr", "data", 72),
      slot("enc", "expr", '"utf-8"', 56),
    ],
    color: MISC,
    code: "{result} = {var}.decode({enc})",
    ui: { type: "store_method", result: "result", method: "decode", args: ["enc"] },
  },
];

function buildExtendedBlocks(): Record<string, ExtendedBlockDef> {
  const out: Record<string, ExtendedBlockDef> = {};

  for (const [id, fn, label, valueDefault, code] of BUILTIN_UNARY) {
    out[id] = builtin1(id, fn, label, valueDefault, code);
  }
  for (const [id, fn, label, code] of BUILTIN_BINARY) {
    out[id] = builtin2(id, fn, label, code);
  }
  for (const [id, fn, label, code] of BUILTIN_TERNARY) {
    out[id] = builtin3(id, fn, label, code);
  }
  for (const [id, fn, label, args, inner] of BUILTIN_LIST_WRAP) {
    out[id] = listWrapBuiltin(id, fn, label, args, inner);
  }

  for (const [id, method] of STR_METHOD_0) {
    out[id] = storeMethod(id, method, `.${method}()`, []);
  }
  for (const [id, method, argName, argDefault] of STR_METHOD_1) {
    out[id] = storeMethod(id, method, `.${method}()`, [{ name: argName, default: argDefault }]);
  }
  for (const [id, method, a1, d1] of STR_METHOD_2) {
    out[id] = storeMethod(id, method, `.${method}()`, [{ name: a1, default: d1 }]);
  }

  for (const [id, method, kind, args] of LIST_MISC) {
    if (kind === "store") {
      out[id] = storeMethod(id, method, `.${method}()`, args ?? [], `{result} = {var}.${method}()`);
    } else if (id === "misc_list_sort_rev") {
      out[id] = {
        id,
        category: "misc_00",
        label: ".sort(reverse=)",
        shape: "stack",
        slots: [
          slot("var", "var", "party", 72),
          slot("reverse", "expr", "True", 48),
        ],
        color: MISC,
        code: "{var}.sort(reverse={reverse})",
        ui: { type: "method", method: "sort", args: ["reverse"] },
      };
    } else {
      out[id] = voidMethod(id, method, `.${method}()`, args ?? []);
    }
  }

  for (const [id, method] of DICT_MISC_STORE) {
    out[id] = dictListView(id, method, `.${method}()`);
  }
  for (const [id, method, args] of DICT_MISC_VOID) {
    if (method === "popitem") {
      out[id] = storeMethod(id, method, `.${method}()`, [], `{result} = {var}.popitem()`);
    } else if (method === "setdefault") {
      out[id] = storeMethod(
        id,
        method,
        `.${method}()`,
        args,
        `{result} = {var}.setdefault({key}, {value})`,
      );
    } else {
      out[id] = voidMethod(id, method, `.${method}()`, args);
    }
  }
  for (const [id, method, args] of DICT_MISC_STORE_ARGS) {
    const argCode = args.map((a) => `{${a.name}}`).join(", ");
    out[id] = storeMethod(id, method, `.${method}()`, args, `{result} = dict.${method}(${argCode})`);
  }

  for (const [id, method, args] of SET_VOID) {
    out[id] = voidMethod(id, method, `.${method}()`, args ?? [], "var", "types");
  }
  for (const [id, method, args] of SET_STORE) {
    const argCode = (args ?? []).map((a) => `{${a.name}}`).join(", ");
    out[id] = storeMethod(
      id,
      method,
      `.${method}()`,
      args ?? [],
      argCode ? `{result} = {var}.${method}(${argCode})` : `{result} = {var}.${method}()`,
      "types",
    );
  }

  for (const [id, method, args] of TUPLE_STORE) {
    out[id] = storeMethod(id, method, `.${method}()`, args, undefined, "stats");
  }

  for (const def of MISC_STMTS) {
    out[def.id] = def;
  }

  return out;
}

export const EXTENDED_BLOCK_DEFS = buildExtendedBlocks();

/** 기타-00 블록 ID → 퍼즐 allowed_blocks 별칭 */
export const EXTENDED_ALIASES: Record<string, string> = {
  any: "misc_any",
  all: "misc_all",
  enumerate: "misc_enumerate",
  zip: "misc_zip",
  map: "misc_map",
  filter: "misc_filter",
  reversed: "misc_reversed",
  divmod: "misc_divmod",
  pow: "misc_pow",
  repr: "misc_repr",
  bin: "misc_bin",
  hex: "misc_hex",
  oct: "misc_oct",
  list: "misc_list_fn",
  tuple: "misc_tuple_fn",
  set: "misc_set_fn",
  dict_fn: "misc_dict_fn",
  continue: "misc_continue",
  del: "misc_del_var",
  assert: "misc_assert",
};

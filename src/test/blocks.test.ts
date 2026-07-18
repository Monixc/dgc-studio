import { describe, expect, it } from "vitest";
import { resetBlockUids, specsToBlocks } from "@/features/block-coding/BlockWorkspace";
import { blocksToCode } from "@/core/blocks/codegen";
import { codeToBlocks } from "@/core/blocks/reverseParse";
import { createBlockInstance, getBlockDef, type BlockSpec } from "@/core/blocks/catalog";

describe("block coding: blocks -> python -> blocks", () => {
  it("generates python from a simple if/print block script", () => {
    resetBlockUids(1);
    const specs: BlockSpec[] = [
      { id: "var_set", slots: { name: "hp", value: "45" } },
      {
        id: "if",
        slots: { cond: "hp > 0" },
        body: [{ id: "print", slots: { value: '"살아있다"' } }],
      },
    ];
    const code = blocksToCode({ blocks: specsToBlocks(specs) });
    expect(code).toBe('hp = 45\nif hp > 0:\n    print("살아있다")\n');
  });

  it("parses generated python back into an equivalent block tree", () => {
    const result = codeToBlocks('hp = 45\nif hp > 0:\n    print("살아있다")\n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.blocks.map((b) => b.id)).toEqual(["var_set", "if"]);
    expect(result.blocks[1].body?.map((b) => b.id)).toEqual(["print"]);
  });
});

describe("block coding: no pre-filled example values", () => {
  it("blanks every catalog slot default (print/operator/var_set 등)", () => {
    for (const id of ["print", "var_set", "operator_sub", "for_range"]) {
      const def = getBlockDef(id)!;
      for (const slot of def.slots) expect(slot.default).toBe("");
    }
  });

  it("newly created block instances start with empty slots", () => {
    const inst = createBlockInstance("print");
    expect(inst.slots.value).toBe("");
  });
});

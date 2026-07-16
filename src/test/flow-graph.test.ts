import { describe, it, expect } from "vitest";
import { dslToGraph } from "@/lib/flow-graph";

describe("dslToGraph Layout", () => {
  it("for 루프 안에 if 분기가 있을 때, 참/거짓 노드가 가로로 겹치지 않고 서로 다른 x 좌표를 가져야 한다", () => {
    const dsl = `for i in range(10)
    if i > 5
        process a
    else
        process b`;

    const graph = dslToGraph(dsl);
    
    // Nodes inside the 'for' loop (which have parentId = the for node's id)
    const forNode = graph.nodes.find(n => n.type === "for")!;
    const kids = graph.nodes.filter(n => n.parentId === forNode.id);
    
    expect(kids).toHaveLength(3); // 'if', 'process a', 'process b'
    
    const ifNode = kids.find(n => n.type === "if")!;
    const procA = kids.find(n => n.label === "a")!;
    const procB = kids.find(n => n.label === "b")!;
    
    // Verify that the branching nodes (a and b) have different X positions (not overlapping at 20)
    expect(procA.position).toBeDefined();
    expect(procB.position).toBeDefined();
    expect(procA.position!.x).not.toEqual(procB.position!.x);
    
    // Also, the container size (width) should be large enough to hold both side-by-side
    expect(forNode.width).toBeGreaterThan(180);
    
    // The kids' coordinates should be within the container boundaries
    for (const kid of kids) {
      expect(kid.position!.x).toBeGreaterThanOrEqual(20); // PAD
      expect(kid.position!.y).toBeGreaterThanOrEqual(30 + 20); // HEADER + PAD
    }

    // Verify edge handles: one should be left and the other should be right
    const edgeA = graph.edges.find(e => e.target === procA.id)!;
    const edgeB = graph.edges.find(e => e.target === procB.id)!;

    expect(edgeA.sourceHandle).not.toEqual(edgeB.sourceHandle);
    expect(["left", "right"]).toContain(edgeA.sourceHandle);
    expect(["left", "right"]).toContain(edgeB.sourceHandle);
  });
});

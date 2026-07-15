import { describe, it, expect } from "vitest";
import { parseDsl } from "@/lib/dsl-parser";
import type { FlowchartData } from "@/types/flowchart";

const edgesBetween = (d: FlowchartData, s: string, t: string) =>
  d.edges.filter((e) => e.source === s && e.target === t);
const nodeByType = (d: FlowchartData, type: string) => d.nodes.filter((n) => n.type === type);

describe("parseDsl — 기본", () => {
  it("빈 입력은 노드 0", () => {
    const { data, errors } = parseDsl("");
    expect(data.nodes).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it("순차 흐름 연결", () => {
    const { data } = parseDsl(`start
input n
output n
end`);
    expect(data.nodes.map((n) => n.type)).toEqual(["start", "input", "output", "end"]);
    // 3 간선: start->input->output->end
    expect(data.edges).toHaveLength(3);
  });

  it("키워드 없는 줄은 process 로", () => {
    const { data } = parseDsl(`total = 0`);
    expect(data.nodes).toHaveLength(1);
    expect(data.nodes[0]).toMatchObject({ type: "process", label: "total = 0" });
  });
});

describe("parseDsl — 분기", () => {
  it("if/elif/else 는 마름모 여러 개 + 병합", () => {
    const { data } = parseDsl(`start
if n > 0
    output "양수"
elif n == 0
    output "영"
else
    output "음수"
end`);
    const diamonds = nodeByType(data, "if");
    expect(diamonds).toHaveLength(2); // if + elif
    // 두 마름모는 거짓 간선으로 연결
    const [d0, d1] = diamonds;
    expect(edgesBetween(data, d0.id, d1.id)[0]?.label).toBe("거짓");
    // 세 분기 모두 end 로 병합
    const end = nodeByType(data, "end")[0];
    const intoEnd = data.edges.filter((e) => e.target === end.id);
    expect(intoEnd).toHaveLength(3);
  });

  it("else 없으면 마지막 거짓이 다음으로 흐른다", () => {
    const { data } = parseDsl(`if x
    process a
output done`);
    const diamond = nodeByType(data, "if")[0];
    const out = nodeByType(data, "output")[0];
    // 마름모 거짓 -> output(done) 직결
    expect(edgesBetween(data, diamond.id, out.id)[0]?.label).toBe("거짓");
  });
});

describe("parseDsl — 반복", () => {
  it("for 는 되돌아가기 간선 + 종료 출구", () => {
    const { data } = parseDsl(`for i in range(3)
    process s += i
output s`);
    const loop = nodeByType(data, "for")[0];
    const proc = nodeByType(data, "process")[0];
    expect(edgesBetween(data, loop.id, proc.id)[0]?.label).toBe("반복");
    expect(edgesBetween(data, proc.id, loop.id)).toHaveLength(1); // back edge
    const out = nodeByType(data, "output")[0];
    expect(edgesBetween(data, loop.id, out.id)[0]?.label).toBe("종료");
  });

  it("while 도 조건 되돌아가기", () => {
    const { data } = parseDsl(`while x > 0
    process x -= 1`);
    const w = nodeByType(data, "while")[0];
    const proc = nodeByType(data, "process")[0];
    expect(edgesBetween(data, w.id, proc.id)[0]?.label).toBe("참");
    expect(edgesBetween(data, proc.id, w.id)).toHaveLength(1);
  });
});

describe("parseDsl — 함수/중첩", () => {
  it("def 는 독립 서브그래프, 메인 흐름 통과", () => {
    const { data } = parseDsl(`start
def greet(name)
    output name
output done`);
    const def = nodeByType(data, "def")[0];
    expect(def.scope).toBe("def:greet(name)");
    // 메인: start -> output(done) 직결 (def 건너뜀)
    const start = nodeByType(data, "start")[0];
    const outs = nodeByType(data, "output");
    const done = outs.find((n) => n.label === "done")!;
    expect(edgesBetween(data, start.id, done.id)).toHaveLength(1);
  });

  it("중첩 for 안 if", () => {
    const { data } = parseDsl(`for i in range(n)
    if i > 0
        process a
    process b`);
    expect(nodeByType(data, "for")).toHaveLength(1);
    expect(nodeByType(data, "if")).toHaveLength(1);
    expect(nodeByType(data, "process")).toHaveLength(2);
  });
});

export interface Sb3Script {
  target: string;
  code: string;
}

export function isScratchFile(fileName: string): boolean {
  return /\.sb3$/i.test(fileName);
}

interface Sb3Block {
  topLevel?: boolean;
}

interface Sb3Target {
  name?: string;
  blocks?: Record<string, Sb3Block | unknown>;
}

/**
 * sb3(zip)를 브라우저에서 풀어 최상위 스크립트를 scratchblocks 문법 텍스트로 변환.
 * 실행/수정 없이 블록 모양만 그리기 위한 것. 외부 전송 없음.
 * ponytail: 파싱 불가한 스크립트는 조용히 건너뜀. 정확도 필요하면 opcode별 처리 추가.
 */
export async function loadSb3Scripts(url: string): Promise<Sb3Script[]> {
  // 무거운 라이브러리는 "블록 보기" 눌렀을 때만 로드(메인 번들에서 제외).
  const [{ strFromU8, unzipSync }, { toScratchblocks }] = await Promise.all([
    import("fflate"),
    import("parse-sb3-blocks"),
  ]);

  const response = await fetch(url);
  if (!response.ok) throw new Error("파일을 불러오지 못했습니다.");
  const bytes = new Uint8Array(await response.arrayBuffer());

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("압축을 풀지 못했습니다. sb3 파일이 맞는지 확인해 주세요.");
  }

  const projectRaw = files["project.json"];
  if (!projectRaw) throw new Error("project.json이 없습니다. sb3 파일이 맞는지 확인해 주세요.");
  const project = JSON.parse(strFromU8(projectRaw)) as { targets?: Sb3Target[] };

  const scripts: Sb3Script[] = [];
  for (const target of project.targets ?? []) {
    const blocks = (target.blocks ?? {}) as Record<string, Sb3Block>;
    for (const [id, block] of Object.entries(blocks)) {
      if (!block || typeof block !== "object" || !block.topLevel) continue;
      try {
        // 2번째 인자는 프로젝트 전체가 아니라 해당 타깃의 blocks 딕셔너리.
        const code = toScratchblocks(id, blocks, target.name ?? "", { tab: "  " }).trim();
        if (code) scripts.push({ target: target.name ?? "", code });
      } catch {
        // 파싱 불가한 스크립트는 건너뜀
      }
    }
  }
  return scripts;
}

import { useMemo, useState } from "react";

const API_BASE = "https://n64kgto9e6.execute-api.ap-southeast-2.amazonaws.com";
const DAYS = ["월", "화", "수", "목", "금"];

// 09:00 ~ 21:00, 30분 단위 (24칸). 각 값은 칸 시작 시각의 "0시 기준 분".
const SLOTS = Array.from({ length: 24 }, (_, i) => 9 * 60 + i * 30); // 540..1230

function formatTime(min) {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function slotKey(day, startMin) {
  return `${day} ${formatTime(startMin)}-${formatTime(startMin + 30)}`;
}

function hourLabel(startMin) {
  return `${formatTime(startMin)}-${formatTime(startMin + 30)}`;
}

// 겹침 인원수에 따른 배경색 (히트맵)
function heatColor(count, max) {
  if (count <= 0) return "#ffffff";
  const ratio = max > 0 ? count / max : 0;
  // 연한 파랑 -> 진한 파랑
  const light = 92 - Math.round(ratio * 52); // 92% -> 40%
  return `hsl(212, 90%, ${light}%)`;
}

export default function App() {
  const [roomName, setRoomName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [roomTitle, setRoomTitle] = useState("");
  const [nickname, setNickname] = useState("");
  const [selected, setSelected] = useState([]); // 내가 선택한 slotKey 목록
  const [summary, setSummary] = useState({}); // { slotKey: { count, members } }
  const [status, setStatus] = useState("");
  const [hovered, setHovered] = useState(null); // 현재 마우스를 올린 slotKey

  const maxCount = useMemo(() => {
    const counts = Object.values(summary).map((v) => v?.count ?? 0);
    return counts.length ? Math.max(...counts) : 0;
  }, [summary]);

  // 가장 많이 겹치는 시간대 (최소 1명 이상)
  const bestSlots = useMemo(() => {
    if (maxCount <= 0) return [];
    return Object.entries(summary)
      .filter(([, v]) => (v?.count ?? 0) === maxCount)
      .map(([key]) => key);
  }, [summary, maxCount]);

  async function createRoom(e) {
    e.preventDefault();
    if (!roomName.trim()) return;
    setStatus("방 만드는 중...");
    try {
      const res = await fetch(`${API_BASE}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName.trim() }),
      });
      const data = await res.json();
      const id = data.roomId || data.id || "";
      setRoomId(id);
      setRoomTitle(data.roomName || data.name || roomName.trim());
      setStatus(id ? `방 생성 완료! 이 방 ID를 팀원에게 공유하세요 → ${id}` : "방이 생성되었어요.");
      if (id) await loadRoom(id);
    } catch {
      setStatus("방 생성 중 오류가 났어요.");
    }
  }

  async function loadRoom(targetId = roomId) {
    if (!String(targetId).trim()) return;
    setStatus("방 정보 불러오는 중...");
    try {
      const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(targetId.trim())}`);
      const data = await res.json();
      setRoomId(targetId.trim());
      setRoomTitle(data.roomName || data.name || targetId.trim());
      setSummary(data.summary && typeof data.summary === "object" ? data.summary : {});
      setStatus("불러오기 완료!");
    } catch {
      setStatus("방 정보를 불러오지 못했어요.");
    }
  }

  function toggleSlot(day, startMin) {
    const key = slotKey(day, startMin);
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  }

  function clearSelection() {
    setSelected([]);
  }

  async function saveSchedule(e) {
    e.preventDefault();
    if (!roomId.trim() || !nickname.trim()) {
      setStatus("방 ID와 닉네임을 입력해주세요.");
      return;
    }
    setStatus("시간표 저장 중...");
    try {
      const res = await fetch(
        `${API_BASE}/rooms/${encodeURIComponent(roomId.trim())}/schedules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nickname: nickname.trim(), slots: selected }),
        }
      );
      const data = await res.json();
      if (data.summary && typeof data.summary === "object") {
        setSummary(data.summary);
      } else {
        await loadRoom(roomId.trim());
      }
      setStatus("시간표 저장 완료!");
    } catch {
      setStatus("시간표 저장 중 오류가 났어요.");
    }
  }

  const hoveredMembers =
    hovered && summary[hovered]?.members?.length ? summary[hovered].members : null;

  return (
    <div
      style={{
        maxWidth: 860,
        margin: "40px auto",
        padding: 20,
        fontFamily: "'Pretendard', system-ui, sans-serif",
        color: "#1f2937",
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>🗓️ 팀플 시간 조율</h1>
        <p style={{ color: "#6b7280", margin: 0 }}>
          팀원 모두가 가능한 시간을 한눈에. 방을 만들고 ID를 공유한 뒤, 각자 가능한 시간을 체크하세요.
        </p>
      </header>

      {status && (
        <p style={{ background: "#eff6ff", color: "#1d4ed8", padding: 12, borderRadius: 8 }}>
          {status}
        </p>
      )}

      <section style={cardStyle}>
        <h2 style={h2Style}>1. 방 만들기 / 불러오기</h2>
        <form onSubmit={createRoom} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            placeholder="방 이름 (예: OO조 회의)"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            style={inputStyle}
          />
          <button type="submit" style={primaryBtn}>방 생성</button>
        </form>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="불러올 방 ID 입력"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={inputStyle}
          />
          <button type="button" onClick={() => loadRoom()} style={secondaryBtn}>
            방 불러오기
          </button>
        </div>
        {roomTitle && (
          <p style={{ marginTop: 10 }}>
            현재 방: <strong>{roomTitle}</strong>{" "}
            {roomId && (
              <span style={{ color: "#6b7280" }}>
                (ID: <code>{roomId}</code>)
              </span>
            )}
          </p>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={h2Style}>2. 내 가능 시간 선택</h2>
        <form onSubmit={saveSchedule}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input
              placeholder="닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              style={{ ...inputStyle, flex: "1 1 200px" }}
            />
            <button type="button" onClick={clearSelection} style={secondaryBtn}>
              선택 초기화
            </button>
            <button type="submit" style={primaryBtn}>
              내 시간표 저장 ({selected.length}칸)
            </button>
          </div>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 0 }}>
            칸을 클릭해 가능한 시간을 선택하세요. 다시 클릭하면 해제됩니다.
          </p>
          <ScheduleTable
            mode="select"
            selected={selected}
            onToggle={toggleSlot}
          />
        </form>
      </section>

      <section style={cardStyle}>
        <h2 style={h2Style}>3. 전체 가능 시간 (겹침 현황)</h2>
        {maxCount <= 0 ? (
          <p style={{ color: "#6b7280" }}>
            아직 저장된 시간표가 없어요. 방을 만들거나 불러온 뒤 시간표를 저장해보세요.
          </p>
        ) : (
          <>
            <p style={{ marginTop: 0 }}>
              가장 많이 겹치는 시간(<strong>{maxCount}명</strong>):{" "}
              {bestSlots.length ? (
                <strong style={{ color: "#1d4ed8" }}>{bestSlots.join(", ")}</strong>
              ) : (
                "-"
              )}
            </p>
            <ScheduleTable
              mode="summary"
              summary={summary}
              maxCount={maxCount}
              onHover={setHovered}
            />
            <div style={{ minHeight: 24, marginTop: 10, fontSize: 14 }}>
              {hoveredMembers ? (
                <span>
                  <strong>{hovered}</strong> 가능: {hoveredMembers.join(", ")}
                </span>
              ) : (
                <span style={{ color: "#9ca3af" }}>
                  칸에 마우스를 올리면 가능한 사람이 표시됩니다.
                </span>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ScheduleTable({ mode, selected = [], onToggle, summary = {}, maxCount = 0, onHover }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
        <thead>
          <tr>
            <th style={thStyle}>시간</th>
            {DAYS.map((d) => (
              <th key={d} style={thStyle}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map((startMin) => (
            <tr key={startMin}>
              <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: "nowrap", background: "#f9fafb" }}>
                {hourLabel(startMin)}
              </td>
              {DAYS.map((day) => {
                const key = slotKey(day, startMin);
                if (mode === "select") {
                  const active = selected.includes(key);
                  return (
                    <td
                      key={key}
                      onClick={() => onToggle(day, startMin)}
                      style={{
                        ...tdStyle,
                        cursor: "pointer",
                        textAlign: "center",
                        background: active ? "#2563eb" : "#fff",
                        color: active ? "#fff" : "#9ca3af",
                        fontWeight: active ? 700 : 400,
                        userSelect: "none",
                      }}
                    >
                      {active ? "가능" : ""}
                    </td>
                  );
                }
                const count = summary[key]?.count ?? 0;
                return (
                  <td
                    key={key}
                    onMouseEnter={() => onHover?.(key)}
                    onMouseLeave={() => onHover?.(null)}
                    style={{
                      ...tdStyle,
                      textAlign: "center",
                      background: heatColor(count, maxCount),
                      color: count > maxCount / 2 ? "#fff" : "#1f2937",
                      fontWeight: count > 0 ? 700 : 400,
                      cursor: count > 0 ? "pointer" : "default",
                    }}
                  >
                    {count > 0 ? count : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  marginBottom: 20,
  background: "#fff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const h2Style = { fontSize: 18, marginTop: 0, marginBottom: 14 };

const inputStyle = {
  flex: 1,
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
};

const primaryBtn = {
  padding: "8px 16px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
};

const secondaryBtn = {
  padding: "8px 16px",
  background: "#f3f4f6",
  color: "#374151",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
};

const thStyle = {
  border: "1px solid #e5e7eb",
  padding: 8,
  background: "#f9fafb",
  fontSize: 14,
};

const tdStyle = {
  border: "1px solid #e5e7eb",
  padding: "8px 6px",
  fontSize: 13,
};

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
  if (count <= 0) return "#fffafc";
  const ratio = max > 0 ? count / max : 0;
  // 연한 핑크 -> 진한 핑크
  const light = 95 - Math.round(ratio * 35); // 95% -> 60%
  return `hsl(340, 100%, ${light}%)`;
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

  // 가장 많이 겹치는 시간대 (최소 1명 이상). 각 항목에 참여자 이름도 함께 담는다.
  const bestSlots = useMemo(() => {
    if (maxCount <= 0) return [];
    return Object.entries(summary)
      .filter(([, v]) => (v?.count ?? 0) === maxCount)
      .map(([key, v]) => ({ key, members: v?.members ?? [] }));
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data.message || "방 생성에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
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
    const id = String(targetId).trim();
    if (!id) return;
    setStatus("방 정보 불러오는 중...");
    try {
      const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(
          res.status === 404
            ? "그런 방 ID를 찾을 수 없어요. ID를 다시 확인해주세요."
            : data.message || "방 정보를 불러오지 못했어요."
        );
        return;
      }
      setRoomId(id);
      setRoomTitle(data.roomName || data.name || id);
      setSummary(data.summary && typeof data.summary === "object" ? data.summary : {});

      // 이미 저장해 둔 내 시간표가 있으면 선택 상태로 복원 (다른 브라우저에서도 동일하게 보이도록)
      const me = nickname.trim();
      if (me && data.schedules && Array.isArray(data.schedules[me])) {
        setSelected(data.schedules[me]);
      }

      setStatus("불러오기 완료!");
    } catch {
      setStatus("방 정보를 불러오지 못했어요. 네트워크 상태를 확인해주세요.");
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
    if (selected.length === 0) {
      setStatus("가능한 시간을 한 칸 이상 선택한 뒤 저장해주세요.");
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data.message || "시간표 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      if (data.summary && typeof data.summary === "object") {
        setSummary(data.summary);
      } else {
        await loadRoom(roomId.trim());
      }
      setStatus(`${nickname.trim()}님의 시간표(${selected.length}칸)를 저장했어요!`);
    } catch {
      setStatus("시간표 저장 중 오류가 났어요. 네트워크 상태를 확인해주세요.");
    }
  }

  const hoveredMembers =
    hovered && summary[hovered]?.members?.length ? summary[hovered].members : null;

  return (
    <div
      style={{
        maxWidth: 860,
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "'Gaegu', 'Jua', system-ui, sans-serif",
        fontSize: 16,
        color: "#5b5266",
        background: "#fff7f0",
        minHeight: "100vh",
      }}
    >
      <header style={{ marginBottom: 28, textAlign: "center" }}>
        <h1
          style={{
            margin: "0 0 12px",
            lineHeight: 1.3,
            fontFamily: "'Jua', system-ui, sans-serif",
            fontSize: 38,
            color: "#ff8fab",
            textShadow: "2px 2px 0 #fff0f5",
          }}
        >
          � 공강 메이트 찾기
        </h1>
        <p style={{ color: "#9a8fa6", margin: 0, lineHeight: 1.7, fontSize: 17 }}>
          친구 모두가 가능한 시간을 한눈에! 방을 만들고 ID를 공유한 뒤, 각자 가능한 시간을 콕콕 체크해요 🧸
        </p>
      </header>

      {status && (
        <p
          style={{
            background: "#fff0f5",
            color: "#ff6f91",
            padding: "14px 18px",
            borderRadius: 20,
            border: "2px dashed #ffc2d4",
            textAlign: "center",
            fontSize: 16,
          }}
        >
          {status}
        </p>
      )}

      <section style={cardStyle}>
        <h2 style={h2Style}>🏠 1. 방 만들기 / 불러오기</h2>
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
              <span style={{ color: "#9a8fa6" }}>
                (ID: <code>{roomId}</code>)
              </span>
            )}
          </p>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={h2Style}>✏️ 2. 내 가능 시간 선택</h2>
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
          <p style={{ fontSize: 15, color: "#9a8fa6", marginTop: 0 }}>
            칸을 콕 눌러 가능한 시간을 골라요. 다시 누르면 취소돼요 🐾
          </p>
          <ScheduleTable
            mode="select"
            selected={selected}
            onToggle={toggleSlot}
          />
        </form>
      </section>

      <section style={cardStyle}>
        <h2 style={h2Style}>🎀 3. 전체 가능 시간 (겹침 현황)</h2>
        {maxCount <= 0 ? (
          <p style={{ color: "#9a8fa6" }}>
            아직 저장된 시간표가 없어요. 방을 만들거나 불러온 뒤 시간표를 저장해보세요 🐣
          </p>
        ) : (
          <>
            <p style={{ marginTop: 0 }}>
              가장 많이 겹치는 시간 — <strong>{maxCount}명</strong>이 가능해요:
            </p>
            <ul style={{ margin: "0 0 14px", paddingLeft: 0, listStyle: "none" }}>
              {bestSlots.map(({ key, members }) => (
                <li
                  key={key}
                  style={{
                    padding: "12px 16px",
                    marginBottom: 8,
                    background: "#f3f0ff",
                    borderRadius: 18,
                    fontSize: 16,
                  }}
                >
                  <strong style={{ color: "#9d7bea" }}>⭐ {key}</strong>
                  <span style={{ color: "#9a8fa6" }}>
                    {" "}— {members.length ? members.join(", ") : "참여자 정보 없음"}
                  </span>
                </li>
              ))}
            </ul>
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
                <span style={{ color: "#c4b7cc" }}>
                  칸에 마우스를 올리면 가능한 사람이 표시돼요 🐱
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
              <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: "nowrap", background: "#fff0f5", color: "#ff8fab" }}>
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
                        background: active ? "#ff8fab" : "#fffafc",
                        color: active ? "#fff" : "#d9c7d2",
                        fontWeight: active ? 700 : 400,
                        userSelect: "none",
                      }}
                    >
                      {active ? "💖" : ""}
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
                      color: count > maxCount / 2 ? "#fff" : "#9a8fa6",
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
  border: "2px solid #ffe3ec",
  borderRadius: 28,
  padding: 24,
  marginBottom: 24,
  background: "#ffffff",
  boxShadow: "0 8px 24px rgba(255, 143, 171, 0.14)",
};

const h2Style = {
  fontSize: 22,
  marginTop: 0,
  marginBottom: 16,
  color: "#ff6f91",
  fontFamily: "'Jua', system-ui, sans-serif",
};

const inputStyle = {
  flex: 1,
  padding: "12px 16px",
  border: "2px solid #ffe3ec",
  borderRadius: 999,
  fontSize: 16,
  fontFamily: "inherit",
  color: "#5b5266",
  background: "#fffafc",
  boxSizing: "border-box",
  outline: "none",
};

const primaryBtn = {
  padding: "12px 24px",
  background: "#ff8fab",
  color: "#fff",
  border: "none",
  borderRadius: 999,
  cursor: "pointer",
  fontSize: 16,
  fontWeight: 700,
  fontFamily: "'Jua', system-ui, sans-serif",
  boxShadow: "0 4px 12px rgba(255, 143, 171, 0.35)",
};

const secondaryBtn = {
  padding: "12px 20px",
  background: "#fff0f5",
  color: "#ff8fab",
  border: "2px solid #ffd4e1",
  borderRadius: 999,
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 700,
  fontFamily: "inherit",
};

const thStyle = {
  border: "2px solid #fff0f5",
  padding: 10,
  background: "#fff0f5",
  color: "#ff6f91",
  fontSize: 15,
  fontFamily: "'Jua', system-ui, sans-serif",
};

const tdStyle = {
  border: "2px solid #fff5f8",
  padding: "8px 6px",
  fontSize: 14,
  borderRadius: 10,
};

import { useState } from "react";

const API_BASE = "https://n64kgto9e6.execute-api.ap-southeast-2.amazonaws.com";
const DAYS = ["월", "화", "수", "목", "금"];
const SLOTS = ["아침", "점심", "저녁"];

export default function App() {
  const [roomName, setRoomName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [roomTitle, setRoomTitle] = useState("");
  const [nickname, setNickname] = useState("");
  const [selected, setSelected] = useState([]);
  const [summary, setSummary] = useState([]);
  const [status, setStatus] = useState("");

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
      setRoomTitle(data.name || roomName.trim());
      setStatus(id ? `방 생성 완료! (ID: ${id})` : "방이 생성되었어요.");
      if (id) await loadRoom(id);
    } catch {
      setStatus("방 생성 중 오류가 났어요.");
    }
  }

  async function loadRoom(targetId = roomId) {
    if (!targetId.trim()) return;
    setStatus("방 정보 불러오는 중...");
    try {
      const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(targetId.trim())}`);
      const data = await res.json();
      setRoomId(targetId.trim());
      setRoomTitle(data.name || targetId.trim());
      setSummary(Array.isArray(data.summary) ? data.summary : []);
      setStatus("불러오기 완료!");
    } catch {
      setStatus("방 정보를 불러오지 못했어요.");
    }
  }

  function toggleSlot(day, slot) {
    const key = `${day}-${slot}`;
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  }

  async function saveSchedule(e) {
    e.preventDefault();
    if (!roomId.trim() || !nickname.trim()) {
      setStatus("방 ID와 닉네임을 입력해주세요.");
      return;
    }
    setStatus("시간표 저장 중...");
    try {
      await fetch(`${API_BASE}/rooms/${encodeURIComponent(roomId.trim())}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          slots: selected,
        }),
      });
      setStatus("시간표 저장 완료!");
      await loadRoom(roomId.trim());
    } catch {
      setStatus("시간표 저장 중 오류가 났어요.");
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 20, fontFamily: "sans-serif" }}>
      <h1>Campus Meal Matcher</h1>
      {status && <p style={{ background: "#f3f4f6", padding: 10, borderRadius: 8 }}>{status}</p>}

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <h2>1. 방 만들기 / 불러오기</h2>
        <form onSubmit={createRoom} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            placeholder="방 이름 (예: 점심팟)"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            style={{ flex: 1, padding: 8 }}
          />
          <button type="submit" style={{ padding: "8px 14px" }}>방 생성</button>
        </form>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="불러올 방 ID 입력"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={{ flex: 1, padding: 8 }}
          />
          <button type="button" onClick={() => loadRoom()} style={{ padding: "8px 14px" }}>
            방 불러오기
          </button>
        </div>
        {roomTitle && (
          <p style={{ marginTop: 10 }}>
            현재 방: <strong>{roomTitle}</strong> {roomId && `(ID: ${roomId})`}
          </p>
        )}
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <h2>2. 가능 시간 선택 및 저장</h2>
        <form onSubmit={saveSchedule}>
          <input
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            style={{ padding: 8, marginBottom: 12, width: "100%", boxSizing: "border-box" }}
          />
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #ddd", padding: 8 }}>시간</th>
                {DAYS.map((d) => (
                  <th key={d} style={{ border: "1px solid #ddd", padding: 8 }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((slot) => (
                <tr key={slot}>
                  <td style={{ border: "1px solid #ddd", padding: 8, fontWeight: "bold" }}>{slot}</td>
                  {DAYS.map((day) => {
                    const key = `${day}-${slot}`;
                    const active = selected.includes(key);
                    return (
                      <td
                        key={key}
                        onClick={() => toggleSlot(day, slot)}
                        style={{
                          border: "1px solid #ddd",
                          padding: 10,
                          textAlign: "center",
                          cursor: "pointer",
                          background: active ? "#dbeafe" : "#fff",
                        }}
                      >
                        {active ? "가능" : "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <button type="submit" style={{ padding: "8px 16px" }}>시간표 저장</button>
        </form>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <h2>3. 참여 요약</h2>
        {summary.length === 0 ? (
          <p>아직 저장된 요약이 없어요. 방을 만들거나 불러온 뒤 시간표를 저장해보세요.</p>
        ) : (
          <ul>
            {summary.map((item, idx) => (
              <li key={idx}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

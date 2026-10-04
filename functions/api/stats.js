// 统计看板数据: GET /api/stats → 近30天 DAU 曲线 + 今日版本分布
// 数据源: 每日 key(day:YYYY-MM-DD) = { uid: {v, os} }
// 日期字符串可预测, 直接循环读取, 无需 KV 枚举能力
export async function onRequestGet({ env }) {
  const days = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }

  let totalUsers = {};   // uid -> 最近版本(近30天去重 = 月活近似)
  const daily = [];      // [{day, count}]
  const versionMap = {}; // version -> 当日装机数
  const latestDay = days[days.length - 1];

  for (const day of days) {
    let users = {};
    try {
      users = JSON.parse((await env.STATS.get(`day:${day}`)) || '{}');
    } catch (e) {
      users = {};
    }
    daily.push({ day, count: Object.keys(users).length });
    if (day === latestDay) {
      for (const uid of Object.keys(users)) {
        const v = users[uid].v || '?';
        versionMap[v] = (versionMap[v] || 0) + 1;
      }
    }
    Object.assign(totalUsers, users);
  }

  return new Response(JSON.stringify({
    ok: true,
    mau: Object.keys(totalUsers).length,          // 近30天活跃(月活近似)
    dauToday: daily[daily.length - 1].count,      // 今日 DAU
    daily,                                        // 30 天曲线
    versions: versionMap,                         // 今日版本分布
  }), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}

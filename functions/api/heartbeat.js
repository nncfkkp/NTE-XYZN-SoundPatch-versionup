// 统计心跳收集: POST {uid, v, os}
// 存储策略: 每日单 key(day:YYYY-MM-DD) 存 JSON map, 读改写合并
// 说明: 并发读改写存在极小概率丢心跳(无原子 RMW), 统计场景可接受;
//       每台机器每自然日仅 1 次心跳(客户端节流), 写量极小
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    // 字段校验+截断: 只接受约定格式, uid 为客户端随机 UUID(匿名)
    const uid = String(body.uid || '').slice(0, 64);
    const v = String(body.v || '').slice(0, 16);
    const os = String(body.os || '').slice(0, 16);
    if (!uid || !v) {
      return json({ ok: false }, 400);
    }
    // uid 格式白名单(随机UUID): 防滥用写入垃圾数据
    if (!/^[a-f0-9-]{8,64}$/i.test(uid)) {
      return json({ ok: false }, 400);
    }

    const day = new Date().toISOString().slice(0, 10); // UTC 日期
    const key = `day:${day}`;

    // 读改写合并(丢并发可容忍)
    let users = {};
    try {
      users = JSON.parse((await env.STATS.get(key)) || '{}');
    } catch (e) {
      users = {};
    }
    users[uid] = { v, os };

    await env.STATS.put(key, JSON.stringify(users));
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false }, 400);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

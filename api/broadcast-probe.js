const SB_URL = 'https://wochetemsnrysnjrgoed.supabase.co';
const SB_KEY = 'sb_publishable_vk1EKES125_AzGi9iPHxSw_XiliPhcA';

const hex = (n) => Array.from({length:n}, () => Math.floor(Math.random()*16).toString(16)).join('');
const code = () => Array.from({length:8}, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');

async function rpc(name, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
    method:'POST',
    headers:{
      apikey:SB_KEY,
      Authorization:`Bearer ${SB_KEY}`,
      'content-type':'application/json'
    },
    body:JSON.stringify(args)
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text) } catch { body = text }
  return {ok:r.ok,status:r.status,body};
}

function subscribeBroadcast(sessionCode) {
  return new Promise((resolve,reject) => {
    const ws = new WebSocket(
      `${SB_URL.replace(/^http/,'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(SB_KEY)}&vsn=1.0.0`
    );
    const topic = `realtime:session:${sessionCode}`;
    const timeout = setTimeout(() => {
      try { ws.close() } catch {}
      reject(new Error('WebSocket subscribe timeout'));
    }, 10000);

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({
        topic,
        event:'phx_join',
        payload:{
          config:{
            broadcast:{ack:false,self:false},
            presence:{key:''},
            postgres_changes:[],
            private:false
          },
          access_token:SB_KEY
        },
        ref:'1',
        join_ref:'1'
      }));
    });

    ws.addEventListener('message', ev => {
      let msg;
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString()) } catch { return }
      if (msg.event === 'phx_reply' && msg.ref === '1' && msg.payload?.status === 'ok') {
        clearTimeout(timeout);
        resolve({
          ws,
          waitForUpdate() {
            return new Promise((res,rej) => {
              const t=setTimeout(() => rej(new Error('Broadcast update timeout')),10000);
              const onMessage = e => {
                let m;
                try { m = JSON.parse(typeof e.data === 'string' ? e.data : e.data.toString()) } catch { return }
                if (m.event !== 'broadcast') return;
                if (m.payload?.event !== 'session_update') return;
                clearTimeout(t);
                ws.removeEventListener('message', onMessage);
                res(m.payload.payload);
              };
              ws.addEventListener('message', onMessage);
            })
          }
        });
      }
    });

    ws.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('WebSocket error'));
    });
  });
}

export default async function handler(req, res) {
  const SESSION = code();
  const OLD = hex(64);
  const NEW = hex(64);
  const data0 = {
    e:false,
    courts:[{n:'Court 1',a:true,p:['Handoff-A','Handoff-B','Handoff-C','Handoff-D'],s:[0,0]}],
    nx:[], q:[], lb:[]
  };

  const result = {session:SESSION,checks:{}};
  let viewer;
  try {
    const initial = await rpc('publish_pickle_session',{p_code:SESSION,p_host_key:OLD,p_payload:data0});
    if (!initial.ok) throw new Error('Initial publish failed: '+JSON.stringify(initial));
    result.checks.initialPublish=true;

    viewer = await subscribeBroadcast(SESSION);
    result.checks.viewerSubscribed=true;

    const updatePromise = viewer.waitForUpdate();
    const rotated = await rpc('rotate_pickle_host_key',{p_code:SESSION,p_old_key:OLD,p_new_key:NEW});
    if (!rotated.ok) throw new Error('Rotation failed: '+JSON.stringify(rotated));
    result.checks.rotation=true;

    const published = await rpc('publish_pickle_session',{p_code:SESSION,p_host_key:NEW,p_payload:{
      ...data0,courts:[{...data0.courts[0],s:[1,0]}]
    }});
    if (!published.ok) throw new Error('New-host publish failed: '+JSON.stringify(published));
    result.checks.newHostPublish=true;

    const payload = await updatePromise;
    result.broadcastScore = payload?.data?.courts?.[0]?.s || null;
    if (JSON.stringify(result.broadcastScore) !== JSON.stringify([1,0])) {
      throw new Error('Broadcast delivered unexpected score: '+JSON.stringify(result.broadcastScore));
    }
    result.checks.viewerReceivedNewHostUpdate=true;

    const stale = await rpc('publish_pickle_session',{p_code:SESSION,p_host_key:OLD,p_payload:{
      ...data0,courts:[{...data0.courts[0],s:[2,0]}]
    }});
    result.checks.oldHostRejected = !stale.ok;
    if (stale.ok) throw new Error('Old host key was still accepted');

    const replay = await rpc('rotate_pickle_host_key',{p_code:SESSION,p_old_key:OLD,p_new_key:hex(64)});
    result.checks.replayFails = !replay.ok;
    if (replay.ok) throw new Error('Replay of original handoff key succeeded');

    result.passed = Object.values(result.checks).every(Boolean);
  } catch (e) {
    result.passed=false;
    result.error=e.message;
  } finally {
    try { viewer?.ws?.close() } catch {}
    await rpc('publish_pickle_session',{p_code:SESSION,p_host_key:NEW,p_payload:{...data0,e:true}}).catch(()=>{});
  }
  res.status(result.passed ? 200 : 500).json(result);
}

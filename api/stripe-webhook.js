const crypto=require('node:crypto');
const getRawBody=req=>new Promise((resolve,reject)=>{const chunks=[];req.on('data',chunk=>chunks.push(chunk));req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject)});
const verify=(body,header,secret)=>{const parts=Object.fromEntries(String(header||'').split(',').map(part=>part.split('='))),timestamp=Number(parts.t),signature=parts.v1;if(!timestamp||!signature||Math.abs(Date.now()/1000-timestamp)>300)return false;const expected=crypto.createHmac('sha256',secret).update(`${timestamp}.`).update(body).digest('hex');const a=Buffer.from(signature),b=Buffer.from(expected);return a.length===b.length&&crypto.timingSafeEqual(a,b)};

module.exports=async function handler(req,res){
  if(req.method!=='POST'){res.statusCode=405;return res.end('Method not allowed')}
  const secret=process.env.STRIPE_WEBHOOK_SECRET,supabaseUrl=process.env.SUPABASE_URL,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!secret||!supabaseUrl||!serviceKey){res.statusCode=503;return res.end('Webhook not configured')}
  try{
    const raw=await getRawBody(req);if(!verify(raw,req.headers['stripe-signature'],secret)){res.statusCode=400;return res.end('Invalid signature')}
    const event=JSON.parse(raw.toString('utf8')),session=event.data?.object,orderId=session?.metadata?.order_id||session?.client_reference_id;if(!orderId){res.statusCode=200;return res.end('Ignored')}
    const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'};
    const paid=event.type==='checkout.session.async_payment_succeeded'||(event.type==='checkout.session.completed'&&session.payment_status==='paid');
    if(paid){const response=await fetch(`${supabaseUrl}/rest/v1/rpc/complete_website_order`,{method:'POST',headers,body:JSON.stringify({p_order_id:orderId,p_customer_name:session.customer_details?.name||null,p_customer_email:session.customer_details?.email||null,p_customer_phone:session.customer_details?.phone||null,p_payment_intent_id:session.payment_intent||null})});if(!response.ok)throw new Error('Unable to complete order')}
    if(['checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type))await fetch(`${supabaseUrl}/rest/v1/website_orders?id=eq.${orderId}`,{method:'PATCH',headers,body:JSON.stringify({payment_status:event.type.endsWith('failed')?'failed':'cancelled',updated_at:new Date().toISOString()})});
    res.statusCode=200;res.end('ok');
  }catch(error){res.statusCode=400;res.end('Webhook error')}
};

module.exports.config={api:{bodyParser:false}};

const SITE_FALLBACK='https://www.offshoresupportservices.ae';
const json=(res,status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body))};
const sbHeaders=key=>({apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'});

module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  const stripeKey=process.env.STRIPE_SECRET_KEY,supabaseUrl=process.env.SUPABASE_URL,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!stripeKey||!supabaseUrl||!serviceKey)return json(res,503,{error:'Online payment is being configured. Please use Enquire for now.'});
  try{
    const requestBody=typeof req.body==='string'?JSON.parse(req.body):req.body;
    const requested=Array.isArray(requestBody?.items)?requestBody.items.slice(0,40):[];
    const quantities=new Map(requested.map(item=>[String(item.id),Math.max(1,Math.min(99,Number(item.quantity)||1))]));
    const ids=[...quantities.keys()].filter(id=>/^[0-9a-f-]{36}$/i.test(id));if(!ids.length)return json(res,400,{error:'Your cart is empty.'});
    const query=`${supabaseUrl}/rest/v1/website_store_items?id=in.(${ids.join(',')})&published=eq.true&purchasable=eq.true&select=id,title,summary,sku,price_amount,currency,stock_quantity,max_order_quantity`;
    const productResponse=await fetch(query,{headers:sbHeaders(serviceKey)});if(!productResponse.ok)throw new Error('Unable to validate products.');
    const products=await productResponse.json();if(products.length!==ids.length)return json(res,409,{error:'One or more products are no longer available.'});
    const currencies=new Set(products.map(item=>String(item.currency||'AED').toLowerCase()));if(currencies.size!==1)return json(res,409,{error:'Products using different currencies must be purchased separately.'});
    const items=products.map(product=>{const quantity=quantities.get(String(product.id)),limit=Math.max(1,Math.min(99,Number(product.max_order_quantity)||10));if(quantity>limit)throw new Error(`Maximum quantity for ${product.title} is ${limit}.`);if(product.stock_quantity!==null&&Number(product.stock_quantity)<quantity)throw new Error(`Only ${product.stock_quantity} of ${product.title} is available.`);if(!(Number(product.price_amount)>0))throw new Error(`${product.title} is available by enquiry only.`);return {...product,quantity,line_total:Number(product.price_amount)*quantity}});
    const currency=[...currencies][0],total=items.reduce((sum,item)=>sum+item.line_total,0),site=(process.env.SITE_URL||SITE_FALLBACK).replace(/\/$/,'');
    const orderResponse=await fetch(`${supabaseUrl}/rest/v1/website_orders`,{method:'POST',headers:{...sbHeaders(serviceKey),Prefer:'return=representation'},body:JSON.stringify({amount_total:total,currency:currency.toUpperCase(),payment_status:'pending'})});
    if(!orderResponse.ok)throw new Error('Unable to create order.');const [order]=await orderResponse.json();
    const orderItems=items.map(item=>({order_id:order.id,store_item_id:item.id,title:item.title,sku:item.sku||null,quantity:item.quantity,unit_price:item.price_amount,line_total:item.line_total,currency:currency.toUpperCase()}));
    const itemResponse=await fetch(`${supabaseUrl}/rest/v1/website_order_items`,{method:'POST',headers:sbHeaders(serviceKey),body:JSON.stringify(orderItems)});if(!itemResponse.ok)throw new Error('Unable to save order items.');
    const params=new URLSearchParams({mode:'payment',success_url:`${site}/order-success.html?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${site}/store.html?checkout=cancelled`,client_reference_id:order.id,'metadata[order_id]':order.id,billing_address_collection:'required','phone_number_collection[enabled]':'true',customer_creation:'always',submit_type:'pay'});
    items.forEach((item,index)=>{params.set(`line_items[${index}][price_data][currency]`,currency);params.set(`line_items[${index}][price_data][unit_amount]`,String(Math.round(Number(item.price_amount)*100)));params.set(`line_items[${index}][price_data][product_data][name]`,item.title.slice(0,120));if(item.summary)params.set(`line_items[${index}][price_data][product_data][description]`,item.summary.slice(0,450));params.set(`line_items[${index}][quantity]`,String(item.quantity))});
    const stripeResponse=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${stripeKey}`,'Content-Type':'application/x-www-form-urlencoded'},body:params});
    const session=await stripeResponse.json();if(!stripeResponse.ok)throw new Error(session.error?.message||'Unable to start payment.');
    await fetch(`${supabaseUrl}/rest/v1/website_orders?id=eq.${order.id}`,{method:'PATCH',headers:sbHeaders(serviceKey),body:JSON.stringify({stripe_session_id:session.id,updated_at:new Date().toISOString()})});
    return json(res,200,{url:session.url});
  }catch(error){return json(res,400,{error:error.message||'Checkout could not be started.'})}
};

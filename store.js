(()=>{
  const STORAGE_KEY='oss-marine-cart-v1';
  const money=(amount,currency='AED')=>new Intl.NumberFormat('en-AE',{style:'currency',currency,maximumFractionDigits:2}).format(Number(amount)||0);
  const esc=(value='')=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  let cart=[];try{cart=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');if(!Array.isArray(cart))cart=[]}catch(error){cart=[]}
  const save=()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(cart));render()};
  const markup=`<button class="mc-mobile-cart-trigger" type="button" data-cart-open aria-label="Open shopping cart">Cart <b data-cart-count>0</b></button><div class="mc-cart-backdrop" data-cart-close hidden></div><aside class="mc-cart-drawer" aria-label="Shopping cart" aria-hidden="true"><header><div><small>OSS Marine Store</small><h2>Your cart</h2></div><button type="button" data-cart-close aria-label="Close cart">×</button></header><div class="mc-cart-items" data-cart-items></div><footer><div class="mc-cart-total"><span>Total</span><strong data-cart-total>AED 0</strong></div><p>Delivery, inspection and applicable taxes are confirmed during checkout or fulfillment.</p><button class="mc-btn red" type="button" data-cart-checkout>Secure checkout →</button><span class="mc-cart-message" data-cart-message role="status"></span></footer></aside>`;
  document.body.insertAdjacentHTML('beforeend',markup);
  const drawer=document.querySelector('.mc-cart-drawer'),backdrop=document.querySelector('.mc-cart-backdrop'),itemsSlot=document.querySelector('[data-cart-items]'),message=document.querySelector('[data-cart-message]');
  const desktopHost=document.querySelector('.mc-head-contact');if(desktopHost)desktopHost.insertAdjacentHTML('beforeend','<button class="mc-cart-trigger" type="button" data-cart-open>Cart <b data-cart-count>0</b></button>');
  const open=()=>{drawer.setAttribute('aria-hidden','false');drawer.classList.add('open');backdrop.hidden=false;document.body.classList.add('cart-open')};
  const close=()=>{drawer.setAttribute('aria-hidden','true');drawer.classList.remove('open');backdrop.hidden=true;document.body.classList.remove('cart-open')};
  const render=()=>{
    const count=cart.reduce((sum,item)=>sum+item.quantity,0);document.querySelectorAll('[data-cart-count]').forEach(el=>el.textContent=count);
    if(!cart.length){itemsSlot.innerHTML='<div class="mc-cart-empty"><span>◇</span><h3>Your cart is empty</h3><p>Add purchasable products from the marine store.</p></div>';document.querySelector('[data-cart-total]').textContent='AED 0';document.querySelector('[data-cart-checkout]').disabled=true;return}
    itemsSlot.innerHTML=cart.map(item=>`<article class="mc-cart-item"><img src="${esc(item.image)}" alt=""><div><strong>${esc(item.title)}</strong><small>${esc(money(item.price,item.currency))} each</small><div class="mc-cart-quantity"><button type="button" data-cart-minus="${esc(item.id)}">−</button><span>${item.quantity}</span><button type="button" data-cart-plus="${esc(item.id)}">+</button><button class="remove" type="button" data-cart-remove="${esc(item.id)}">Remove</button></div></div><b>${esc(money(item.price*item.quantity,item.currency))}</b></article>`).join('');
    const currencies=[...new Set(cart.map(item=>item.currency))],total=cart.reduce((sum,item)=>sum+item.price*item.quantity,0);document.querySelector('[data-cart-total]').textContent=currencies.length===1?money(total,currencies[0]):'Separate checkout required';document.querySelector('[data-cart-checkout]').disabled=currencies.length!==1;
  };
  document.addEventListener('click',event=>{
    const add=event.target.closest('[data-cart-add]');if(add){const id=add.dataset.cartAdd,existing=cart.find(item=>item.id===id),max=Math.max(1,Number(add.dataset.cartMax)||10);if(existing)existing.quantity=Math.min(max,existing.quantity+1);else cart.push({id,title:add.dataset.cartTitle,price:Number(add.dataset.cartPrice),currency:add.dataset.cartCurrency,image:add.dataset.cartImage,max,quantity:1});message.textContent='Added to cart.';save();open();return}
    if(event.target.closest('[data-cart-open]')){open();return}if(event.target.closest('[data-cart-close]')){close();return}
    const plus=event.target.closest('[data-cart-plus]'),minus=event.target.closest('[data-cart-minus]'),remove=event.target.closest('[data-cart-remove]');
    if(plus){const item=cart.find(x=>x.id===plus.dataset.cartPlus);if(item)item.quantity=Math.min(item.max,item.quantity+1);save()}
    if(minus){const item=cart.find(x=>x.id===minus.dataset.cartMinus);if(item)item.quantity=Math.max(1,item.quantity-1);save()}
    if(remove){cart=cart.filter(x=>x.id!==remove.dataset.cartRemove);save()}
  });
  document.querySelector('[data-cart-checkout]').addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;button.textContent='Preparing secure checkout…';message.textContent='';
    try{const response=await fetch('/api/create-checkout-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:cart.map(item=>({id:item.id,quantity:item.quantity}))})}),data=await response.json();if(!response.ok||!data.url)throw new Error(data.error||'Checkout is unavailable.');location.href=data.url}catch(error){message.textContent=error.message;button.disabled=false;button.textContent='Secure checkout →'}
  });
  addEventListener('keydown',event=>{if(event.key==='Escape')close()});if(location.pathname.endsWith('/order-success.html')){cart=[];localStorage.removeItem(STORAGE_KEY)}render();
})();

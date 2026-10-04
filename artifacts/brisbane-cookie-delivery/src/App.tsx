import { type FormEvent, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateOrder, useListCookies, getListCookiesQueryKey, useListDeliveryZones, getListDeliveryZonesQueryKey, useCheckDeliveryZone, getCheckDeliveryZoneQueryKey, useGetOrder, getGetOrderQueryKey } from '@workspace/api-client-react';
import type { Cookie, Order, OrderInput } from '@workspace/api-client-react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, Cookie as CookieIcon, CreditCard, Gift, MapPin, Minus, Plus, RefreshCw, ShoppingBag, Sparkles, Truck } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

const flavorDefaults = [
  { id: 1, name: 'Classic Choc Chip', slug: 'classic-choc-chip', description: 'The one that started it all. Brown butter, dark chocolate, a tiny pinch of sea salt.', priceCents: 550, stock: 42, tags: ['Bestseller', 'Brown butter'], featured: true },
  { id: 2, name: 'Triple Choc Fudge', slug: 'triple-choc-fudge', description: 'Three kinds of chocolate in one soft, fudgy, very-necessary cookie.', priceCents: 580, stock: 34, tags: ['Rich', 'Gooey'], featured: true },
  { id: 3, name: 'Macadamia & White Choc', slug: 'macadamia-white-choc', description: 'Toasted Queensland macadamias meet creamy white chocolate.', priceCents: 590, stock: 27, tags: ['Local macadamias'], featured: false },
  { id: 4, name: 'Nutella Stuffed', slug: 'nutella-stuffed', description: 'A soft chocolate-hazelnut centre tucked inside golden dough.', priceCents: 620, stock: 21, tags: ['Filled centre'], featured: true },
  { id: 5, name: 'Vegan Biscoff', slug: 'vegan-biscoff', description: 'Plant-based, cinnamon-spiced and full of caramelised biscuit crunch.', priceCents: 590, stock: 18, tags: ['Vegan', 'Dairy-free'], featured: false },
  { id: 6, name: 'Red Velvet', slug: 'red-velvet', description: 'Velvety cocoa dough, white chocolate pockets, a little drama.', priceCents: 590, stock: 24, tags: ['Limited bake'], featured: false },
];

type ShopCookie = Cookie;
type CartLine = { cookie: ShopCookie; quantity: number };
type Fulfillment = 'delivery' | 'pickup';
type Speed = 'standard' | 'express';

const money = (cents: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
const imageFor = (cookie: Pick<Cookie, 'slug' | 'name' | 'imageUrl'>) => {
  const text = `${cookie.slug} ${cookie.name}`.toLowerCase();
  const slug = text.includes('triple') ? 'triple-choc-fudge'
    : text.includes('macadamia') ? 'macadamia-white-choc'
      : text.includes('nutella') ? 'nutella-stuffed'
        : text.includes('biscoff') ? 'vegan-biscoff'
          : text.includes('velvet') ? 'red-velvet' : 'classic-choc-chip';
  return `/cookies/${slug}.png`;
};

function Header({ count }: { count: number }) {
  return <header className="site-header">
    <div className="page-wrap nav-inner">
      <Link href="/" className="brand" data-testid="link-home">
        <span className="brand-mark"><CookieIcon size={20} strokeWidth={2.2} /></span>
        <span className="brand-type">brisbane<br /><b>cookie co.</b></span>
      </Link>
      <nav className="main-nav" aria-label="Main navigation">
        <a href="#menu" data-testid="link-menu">The cookies</a>
        <a href="#delivery" data-testid="link-delivery">Delivery & pickup</a>
        <a href="#build-box" data-testid="link-build-box">Build a box</a>
      </nav>
      <a className="nav-bag" href="#your-box" data-testid="link-cart">
        <ShoppingBag size={17} /><span>Your box</span><b data-testid="text-cart-count">{count}</b>
      </a>
      <a href="#menu" className="nav-mobile-order" data-testid="link-mobile-order">Order cookies <ArrowRight size={15} /></a>
    </div>
  </header>;
}

function Home() {
  const [, setLocation] = useLocation();
  const [boxSize, setBoxSize] = useState<4 | 6 | 12>(4);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [fulfillment, setFulfillment] = useState<Fulfillment>('delivery');
  const [speed, setSpeed] = useState<Speed>('standard');
  const [suburb, setSuburb] = useState('');
  const [giftNote, setGiftNote] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [formError, setFormError] = useState('');
  const cookiesQuery = useListCookies({ query: { queryKey: getListCookiesQueryKey(), refetchInterval: 15000 } });
  const zonesQuery = useListDeliveryZones({ query: { queryKey: getListDeliveryZonesQueryKey() } });
  const createOrder = useCreateOrder();
  const checkParams = { suburb: suburb.trim() || 'Brisbane' };
  const checkQuery = useCheckDeliveryZone(checkParams, {
    query: { enabled: suburb.trim().length > 1, queryKey: getCheckDeliveryZoneQueryKey(checkParams) },
  });

  const cookies = useMemo<ShopCookie[]>(() => {
    const remote = cookiesQuery.data ?? [];
    if (remote.length) return [...remote].sort((a, b) => {
      const aIndex = flavorDefaults.findIndex((flavor) => flavor.slug === a.slug || flavor.name.toLowerCase() === a.name.toLowerCase());
      const bIndex = flavorDefaults.findIndex((flavor) => flavor.slug === b.slug || flavor.name.toLowerCase() === b.name.toLowerCase());
      return (aIndex < 0 ? 20 : aIndex) - (bIndex < 0 ? 20 : bIndex);
    });
    return flavorDefaults.map((flavor) => ({
      ...flavor,
      imageUrl: `/cookies/${flavor.slug}.png`,
    }));
  }, [cookiesQuery.data]);
  const zones = zonesQuery.data ?? [];
  const zone = checkQuery.data?.zone ?? zones.find((entry) => entry.suburb.toLowerCase() === suburb.trim().toLowerCase()) ?? null;
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.cookie.priceCents, 0);
  const deliveryFee = fulfillment === 'pickup' ? 0 : zone ? (speed === 'express' ? zone.expressFeeCents : zone.standardFeeCents) : 0;
  const gst = Math.round((subtotal + deliveryFee) / 11);
  const total = subtotal + deliveryFee;
  const boxRemaining = Math.max(0, boxSize - cartCount);
  const orderable = cartCount === boxSize;
  const serviceable = fulfillment === 'pickup' || (Boolean(zone) && Boolean(checkQuery.data?.serviceable ?? zone));

  function addCookie(cookie: ShopCookie) {
    if (cartCount >= boxSize || cookie.stock <= 0) return;
    setCart((current) => {
      const line = current.find((item) => item.cookie.id === cookie.id);
      return line
        ? current.map((item) => item.cookie.id === cookie.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { cookie, quantity: 1 }];
    });
  }
  function adjustCookie(id: number, amount: number) {
    setCart((current) => current.flatMap((line) => {
      if (line.cookie.id !== id) return [line];
      const quantity = line.quantity + amount;
      return quantity <= 0 ? [] : [{ ...line, quantity }];
    }));
  }
  function chooseBox(size: 4 | 6 | 12) {
    setBoxSize(size);
    setCart((current) => {
      let left = size;
      return current.flatMap((line) => {
        const quantity = Math.min(line.quantity, left);
        left -= quantity;
        return quantity > 0 ? [{ ...line, quantity }] : [];
      });
    });
  }
  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    if (!orderable) {
      setFormError(`Choose ${boxRemaining} more ${boxRemaining === 1 ? 'cookie' : 'cookies'} to fill your box.`);
      return;
    }
    if (fulfillment === 'delivery' && !serviceable) {
      setFormError('Please choose a covered Brisbane suburb, or switch to pickup.');
      return;
    }
    if (cardNumber.replace(/\D/g, '').length < 12) {
      setFormError('Enter a valid test card number to continue.');
      return;
    }
    const order: OrderInput = {
      customerName, email, phone, suburb: suburb.trim() || (fulfillment === 'pickup' ? 'West End' : ''),
      streetAddress: fulfillment === 'delivery' ? streetAddress : undefined,
      fulfillment, speed: fulfillment === 'delivery' ? speed : 'standard',
      boxSize, giftNote: giftNote.trim(), items: cart.map(({ cookie, quantity }) => ({ cookieId: cookie.id, quantity })),
    };
    createOrder.mutate({ data: order }, {
      onSuccess: (created: Order) => setLocation(`/order/${encodeURIComponent(created.orderNumber)}`),
      onError: () => setFormError('We couldn’t place that order just now. Your box is still here — please try again.'),
    });
  }

  return <div className="storefront">
    <Header count={cartCount} />
    <main>
      <section className="hero page-wrap">
        <div className="hero-copy fade-up">
          <div className="hero-kicker"><span className="kicker-dot" /> Baked fresh in Brisbane, every day</div>
          <h1 className="serif">A little<br />more <em>gooey.</em></h1>
          <p>Big, soft-centred cookies for the good bit of your day. Baked in small batches, delivered warm-ish across Brisbane.</p>
          <div className="hero-actions">
            <a href="#menu" className="button button-primary" data-testid="button-shop-cookies">Find your favourite <ArrowRight size={16} /></a>
            <span className="hero-note"><Sparkles size={15} /> No sad, crunchy middles.</span>
          </div>
          <div className="hero-footnote"><Sparkles className="mini-stars" size={15} /> A proper Brisbane bake shop <i /> Made for sharing (or not)</div>
        </div>
        <div className="hero-art">
          <div className="hero-sticker"><span>made</span><b>with<br />butter</b><small>& a lot of love</small></div>
          <div className="hero-photo-frame">
            <img src="/cookies/classic-choc-chip.png" alt="Freshly baked gooey chocolate chunk cookie" data-testid="img-hero-cookie" />
            <div className="photo-label"><span className="label-dot" /> Out of the oven today</div>
          </div>
          <div className="hero-orbit hero-orbit-one" /><div className="hero-orbit hero-orbit-two" />
          <span className="hero-scribble">so good!</span>
        </div>
        <div className="hero-bottom-mark"><ArrowDown size={14} /> SCROLL FOR THE GOOD STUFF</div>
      </section>

      <section className="menu-section" id="menu">
        <div className="page-wrap">
          <div className="section-heading">
            <div><div className="eyebrow section-eyebrow">THE DAILY BATCH <span>— 01 / 06</span></div><h2 className="serif">Meet the <em>crumbs.</em></h2></div>
            <p>Six signatures. A ridiculous amount of chocolate. All baked fresh when you order.</p>
          </div>
          {cookiesQuery.isLoading ? <div className="cookie-grid" aria-label="Loading cookie menu">{flavorDefaults.map((flavor) => <div className="cookie-skeleton" key={flavor.id}><div /><span /></div>)}</div>
            : cookiesQuery.isError ? <div className="query-message"><p>Our menu is taking a tiny oven break.</p><button className="text-button" onClick={() => cookiesQuery.refetch()} data-testid="button-retry-cookies">Try again <RefreshCw size={14} /></button></div>
              : <div className="cookie-grid" data-testid="grid-cookie-menu">
                {cookies.slice(0, 6).map((cookie, index) => <article className="cookie-card" key={cookie.id} data-testid={`card-cookie-${cookie.id}`}>
                  <div className={`cookie-image-wrap cookie-tone-${index}`}>
                    <img src={imageFor(cookie)} alt={cookie.name} data-testid={`img-cookie-${cookie.id}`} />
                    {cookie.featured && <span className="cookie-badge">House favourite</span>}
                    <button className="quick-add" aria-label={`Add ${cookie.name}`} onClick={() => addCookie(cookie)} disabled={cartCount >= boxSize || cookie.stock <= 0} data-testid={`button-add-cookie-${cookie.id}`}><Plus size={19} /></button>
                  </div>
                  <div className="cookie-copy">
                    <div className="cookie-title-line"><h3 className="serif" data-testid={`text-cookie-name-${cookie.id}`}>{cookie.name}</h3><span className="cookie-price">{money(cookie.priceCents)}</span></div>
                    <p>{cookie.description}</p>
                    <div className="cookie-tags">{cookie.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>
                    <small className={cookie.stock <= 0 ? 'stock-note' : 'stock-count'} data-testid={`text-cookie-stock-${cookie.id}`}>
                      {cookie.stock <= 0 ? 'Fresh batch sold out' : `${cookie.stock} available today`}
                    </small>
                  </div>
                </article>)}
              </div>}
          <div className="menu-bottom-note"><Sparkles size={15} /> Baked in small batches. The menu may change as the oven does.</div>
        </div>
      </section>

      <section className="builder-section" id="build-box">
        <div className="page-wrap builder-layout">
          <div className="builder-main">
            <div className="eyebrow section-eyebrow">YOUR BOX, YOUR RULES <span>— 02 / 06</span></div>
            <h2 className="serif">Build a box<br />of <em>happy.</em></h2>
            <p className="builder-intro">A good mix. A very good gift. Or six of the same because you know what you like.</p>
            <div className="box-size-picker" role="group" aria-label="Choose box size">
              {[4, 6, 12].map((size) => <button key={size} onClick={() => chooseBox(size as 4 | 6 | 12)} className={`size-option ${boxSize === size ? 'selected' : ''}`} data-testid={`button-box-size-${size}`}>
                <span className="size-num">{size}</span><span className="size-word">cookies</span>{size === 6 && <i>Just right</i>}
              </button>)}
            </div>
            <div className="box-preview">
              <div className="box-preview-head"><span className="eyebrow">THE COOKIE BOX</span><span>{cartCount} / {boxSize} tucked in</span></div>
              <div className={`cookie-wells wells-${boxSize}`}>
                {Array.from({ length: boxSize }, (_, index) => {
                  const line = cart.find((item) => item.quantity > 0 && cart.slice(0, cart.indexOf(item) + 1).reduce((n, row) => n + row.quantity, 0) > index);
                  return <div className={`cookie-well ${line ? 'well-filled' : ''}`} key={index} data-testid={`box-cookie-slot-${index + 1}`}>
                    {line ? <img src={imageFor(line.cookie)} alt="" /> : <span>{String(index + 1).padStart(2, '0')}</span>}
                  </div>;
                })}
              </div>
              <div className={`box-progress ${orderable ? 'complete' : ''}`}><span style={{ width: `${Math.min(100, cartCount / boxSize * 100)}%` }} /></div>
              <div className="box-hint">{orderable ? <><Check size={15} /> Beautiful box. Ready when you are.</> : <><Sparkles size={14} /> Pick {boxRemaining} more {boxRemaining === 1 ? 'cookie' : 'cookies'} to fill your box.</>}</div>
            </div>
          </div>
          <aside className="cart-panel" id="your-box">
            <div className="cart-panel-head"><div><span className="eyebrow">YOUR BOX</span><h3 className="serif">{cartCount ? 'It’s looking good.' : 'Start your mix.'}</h3></div><ShoppingBag size={19} /></div>
            {cart.length ? <div className="cart-lines">
              {cart.map(({ cookie, quantity }) => <div className="cart-line" key={cookie.id} data-testid={`cart-item-${cookie.id}`}>
                <img src={imageFor(cookie)} alt="" /><div className="cart-line-name"><b>{cookie.name}</b><span>{money(cookie.priceCents)} each</span></div>
                <div className="quantity-control"><button aria-label={`Remove one ${cookie.name}`} onClick={() => adjustCookie(cookie.id, -1)} data-testid={`button-remove-cookie-${cookie.id}`}><Minus size={13} /></button><span data-testid={`text-quantity-${cookie.id}`}>{quantity}</span><button aria-label={`Add one ${cookie.name}`} onClick={() => addCookie(cookie)} disabled={cartCount >= boxSize} data-testid={`button-increment-cookie-${cookie.id}`}><Plus size={13} /></button></div>
              </div>)}
            </div> : <div className="cart-empty"><div className="empty-cookie"><CookieIcon size={22} /></div><p>Your box is a blank canvas.<br />Pick from the menu to fill it.</p><a href="#menu" className="text-button" data-testid="link-pick-cookies">See the cookies <ArrowRight size={14} /></a></div>}
            <div className="cart-subtotal"><span>Cookie subtotal</span><b data-testid="text-subtotal">{money(subtotal)}</b></div>
            <div className="cart-continue"><a href="#delivery" className={`button button-dark ${!orderable ? 'button-muted' : ''}`} data-testid="button-continue-to-delivery">
              {orderable ? 'Make it a delivery' : `Fill your box · ${boxRemaining} to go`} <ArrowRight size={16} />
            </a></div>
            <div className="cart-assurance"><span><Check size={13} /> Baked fresh</span><span><Check size={13} /> Brisbane made</span></div>
          </aside>
        </div>
      </section>

      <section className="delivery-section" id="delivery">
        <div className="page-wrap delivery-layout">
          <div className="delivery-copy">
            <div className="eyebrow section-eyebrow">GET THE GOOD STUFF <span>— 03 / 06</span></div>
            <h2 className="serif">Your suburb.<br />Our <em>oven.</em></h2>
            <p>We deliver across Brisbane, or you can swing by our little bakehouse for pickup. Your call.</p>
            <div className="delivery-modes">
              <button className={`mode-card ${fulfillment === 'delivery' ? 'mode-selected' : ''}`} onClick={() => setFulfillment('delivery')} data-testid="button-fulfillment-delivery">
                <span className="mode-icon"><Truck size={19} /></span><span><b>Deliver to me</b><small>Fresh to your front door</small></span><i>{fulfillment === 'delivery' && <Check size={14} />}</i>
              </button>
              <button className={`mode-card ${fulfillment === 'pickup' ? 'mode-selected' : ''}`} onClick={() => setFulfillment('pickup')} data-testid="button-fulfillment-pickup">
                <span className="mode-icon"><MapPin size={19} /></span><span><b>I’ll pick it up</b><small>Collect from the bakehouse</small></span><i>{fulfillment === 'pickup' && <Check size={14} />}</i>
              </button>
            </div>
            <div className="suburb-field">
              <label htmlFor="suburb">YOUR BRISBANE SUBURB</label>
              <div className="suburb-input-wrap"><MapPin size={17} /><input id="suburb" list="suburb-options" placeholder="Try West End or Paddington" value={suburb} onChange={(event) => setSuburb(event.target.value)} data-testid="input-suburb" /><ChevronDown size={15} /></div>
              <datalist id="suburb-options">{zones.map((entry) => <option key={entry.id} value={entry.suburb}>{entry.postcode}</option>)}</datalist>
              {zonesQuery.isError ? <small className="suburb-feedback error">Suburb list unavailable. You can still enter your suburb and check coverage.</small>
                : suburb.trim().length > 1 && checkQuery.isFetching ? <small className="suburb-feedback">Checking our delivery map…</small>
                  : suburb.trim().length > 1 && checkQuery.data?.serviceable ? <small className="suburb-feedback success"><Check size={13} /> Yep, we deliver to {checkQuery.data.suburb || suburb}.</small>
                    : suburb.trim().length > 1 && !checkQuery.isLoading && checkQuery.data && !checkQuery.data.serviceable ? <small className="suburb-feedback error">Not on our delivery run yet. Pickup is always an option.</small> : null}
            </div>
            {fulfillment === 'delivery' && <div className="speed-picker">
              <span className="eyebrow">DELIVERY SPEED</span>
              <div className="speed-options">
                <button className={speed === 'standard' ? 'speed-selected' : ''} onClick={() => setSpeed('standard')} data-testid="button-speed-standard"><span>Standard</span><small>Fresh & easy</small><b>{zone ? money(zone.standardFeeCents) : 'from $4.50'}</b></button>
                <button className={speed === 'express' ? 'speed-selected' : ''} onClick={() => setSpeed('express')} data-testid="button-speed-express"><span>Express</span><small>Fastest bake-to-door</small><b>{zone ? money(zone.expressFeeCents) : 'from $8.00'}</b></button>
              </div>
            </div>}
          </div>
          <div className="delivery-map-card">
            <div className="map-card-top"><span className="eyebrow">THE BRISBANE BAKE RUN</span><span className="map-dot" /> Taking orders today</div>
            <div className="map-art" aria-label="Illustration of Brisbane delivery area">
              <div className="map-river map-river-a" /><div className="map-river map-river-b" /><div className="map-arc arc-one" /><div className="map-arc arc-two" /><div className="map-arc arc-three" />
              <span className="map-suburb suburb-a">Paddington</span><span className="map-suburb suburb-b">West End</span><span className="map-suburb suburb-c">New Farm</span><span className="map-suburb suburb-d">South Brisbane</span>
              <div className="map-pin pin-main"><MapPin size={20} fill="currentColor" /></div><div className="map-cookie-mark"><CookieIcon size={16} /></div>
            </div>
            <div className="map-card-bottom"><span><Clock3 size={15} /> Baked to order, daily</span><b>{zones.length ? `${zones.length} suburbs & counting` : 'Greater Brisbane'}</b></div>
          </div>
        </div>
      </section>

      <section className="gift-section">
        <div className="page-wrap gift-layout">
          <div className="gift-note-card">
            <div className="gift-icon"><Gift size={22} /></div>
            <div className="eyebrow">ADD A LITTLE NOTE</div>
            <h2 className="serif">Good cookies.<br /><em>Better words.</em></h2>
            <p>Sending a box to someone? Leave a short note and we’ll tuck it in.</p>
            <textarea maxLength={240} value={giftNote} onChange={(event) => setGiftNote(event.target.value)} placeholder="“You deserve the gooey one. Love, me.”" data-testid="input-gift-note" />
            <div className="gift-note-foot"><span>{giftNote.length} / 240</span><span>Printed on a little card</span></div>
          </div>
          <div className="checkout-card">
            <div className="checkout-top"><div className="eyebrow section-eyebrow">THE LAST LITTLE BIT <span>— 04 / 06</span></div><h2 className="serif">Make it <em>yours.</em></h2><p>Where should we send this very good decision?</p></div>
            <form onSubmit={submitOrder} className="checkout-form" data-testid="form-checkout">
              <div className="form-row"><label>YOUR NAME<input required autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Alex Smith" data-testid="input-customer-name" /></label><label>EMAIL ADDRESS<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="alex@example.com" data-testid="input-email" /></label></div>
              <div className="form-row"><label>PHONE NUMBER<input required type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="04xx xxx xxx" data-testid="input-phone" /></label>{fulfillment === 'delivery' && <label>STREET ADDRESS<input required autoComplete="street-address" value={streetAddress} onChange={(event) => setStreetAddress(event.target.value)} placeholder="12 Baker Street" data-testid="input-street-address" /></label>}</div>
              <div className="payment-label"><span>PAYMENT</span><span className="simulated-label"><CreditCard size={13} /> Secure simulated checkout</span></div>
              <label className="card-number-label">CARD NUMBER<div className="card-input"><CreditCard size={17} /><input required inputMode="numeric" value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} data-testid="input-card-number" /><span>VISA</span></div></label>
              <div className="form-row form-row-tight"><label>EXPIRY<input required placeholder="MM / YY" defaultValue="12 / 28" data-testid="input-card-expiry" /></label><label>SECURITY CODE<input required inputMode="numeric" placeholder="CVC" defaultValue="123" data-testid="input-card-cvc" /></label></div>
              <div className="order-totals">
                <div><span>Cookie box · {cartCount} cookies</span><b>{money(subtotal)}</b></div>
                <div><span>{fulfillment === 'pickup' ? 'Pickup' : `${speed === 'express' ? 'Express' : 'Standard'} delivery`}</span><b>{deliveryFee ? money(deliveryFee) : fulfillment === 'pickup' ? 'Free' : '—'}</b></div>
                <div><span>GST (10% included)</span><b>{money(gst)}</b></div>
                <div className="total-line"><span>Total <small>AUD</small></span><b data-testid="text-order-total">{money(total)}</b></div>
              </div>
              {formError && <div className="form-error" role="alert" data-testid="status-checkout-error">{formError}</div>}
              <button type="submit" className="button button-primary checkout-submit" disabled={createOrder.isPending} data-testid="button-place-order">
                {createOrder.isPending ? <><span className="button-pulse" /> Placing your order…</> : <>Place my order · {money(total)} <ArrowRight size={16} /></>}
              </button>
              <p className="checkout-terms">By placing your order, you’re making someone’s day a little gooier.</p>
            </form>
          </div>
        </div>
      </section>

      <section className="last-word">
        <div className="page-wrap last-word-inner"><span className="eyebrow">BRISBANE, BAKED WITH LOVE</span><h2 className="serif">A warm cookie<br />is a <em>whole mood.</em></h2><a href="#menu" className="button button-light" data-testid="button-back-to-menu">Back to the cookies <ArrowRight size={16} /></a></div>
        <div className="last-cookie-illustration"><img src="/cookies/nutella-stuffed.png" alt="" /></div>
      </section>
    </main>
    <footer className="site-footer"><div className="page-wrap footer-inner"><Link href="/" className="brand footer-brand" data-testid="link-footer-home"><span className="brand-mark"><CookieIcon size={17} /></span><span className="brand-type">brisbane<br /><b>cookie co.</b></span></Link><span>Small batch. Big centre. Brisbane, QLD.</span><a href="#menu" data-testid="link-footer-menu">Back to the good stuff ↑</a></div></footer>
  </div>;
}

function OrderTracking() {
  const params = useParams<{ orderNumber: string }>();
  const orderNumber = params.orderNumber ?? '';
  const orderQuery = useGetOrder(orderNumber, { query: { queryKey: getGetOrderQueryKey(orderNumber), refetchInterval: 30000 } });
  const order = orderQuery.data;
  const stages = [
    { id: 'received', title: 'Order received', detail: 'We’ve got your order. Good things are in motion.', icon: Check },
    { id: 'baking', title: 'In the oven', detail: 'Your cookies are being baked fresh, right now.', icon: CookieIcon },
    { id: 'out_for_delivery', title: order?.fulfillment === 'pickup' ? 'Ready for pickup' : 'On the way', detail: order?.fulfillment === 'pickup' ? 'We’ll have your box ready at the bakehouse.' : 'Your cookie box is making its way to you.', icon: Truck },
    { id: 'delivered', title: order?.fulfillment === 'pickup' ? 'Picked up' : 'Delivered', detail: 'The best part starts now.', icon: Sparkles },
  ];
  const currentStage = stages.findIndex((stage) => stage.id === order?.status);
  return <div className="tracking-page">
    <Header count={0} />
    <main className="tracking-main page-wrap">
      <Link href="/" className="back-link" data-testid="link-back-store"><ArrowLeft size={15} /> Back to the cookies</Link>
      {orderQuery.isLoading ? <div className="tracking-card loading-tracking"><div className="skeleton-line wide" /><div className="skeleton-circle" /><div className="skeleton-line" /></div>
        : orderQuery.isError ? <div className="tracking-card tracking-error"><div className="tracking-icon"><CookieIcon size={24} /></div><div className="eyebrow">ORDER LOOKUP</div><h1 className="serif">We can’t find that<br /><em>cookie trail.</em></h1><p>That order number may have a typo, or it hasn’t made it to us yet.</p><button className="button button-primary" onClick={() => orderQuery.refetch()} data-testid="button-retry-order">Try again <RefreshCw size={15} /></button></div>
          : order && <div className="tracking-layout">
            <div className="tracking-card">
              <div className="tracking-head"><div><div className="eyebrow">ORDER {order.orderNumber}</div><h1 className="serif">Good things<br /><em>are baking.</em></h1></div><span className="tracking-stamp"><CookieIcon size={28} /></span></div>
              <p className="tracking-welcome" data-testid="text-order-customer">Hey {order.customerName.split(' ')[0]}, we’ve got your box.</p>
              <div className="status-track" data-testid="status-order-stage">
                {stages.map((stage, index) => {
                  const Icon = stage.icon;
                  const complete = index <= currentStage;
                  return <div className={`track-step ${complete ? 'step-complete' : ''} ${index === currentStage ? 'step-current' : ''}`} key={stage.id}>
                    <div className="track-marker">{complete ? <Icon size={16} /> : <span>{String(index + 1).padStart(2, '0')}</span>}</div>
                    {index < stages.length - 1 && <div className="track-connector" />}
                    <div className="track-copy"><b>{stage.title}</b><small>{stage.detail}</small></div>
                  </div>;
                })}
              </div>
              <div className="tracking-refresh"><span><span className="live-dot" /> Updates automatically every 30 seconds</span><button onClick={() => orderQuery.refetch()} data-testid="button-refresh-order"><RefreshCw size={14} /> Refresh now</button></div>
            </div>
            <aside className="tracking-summary">
              <div className="eyebrow">YOUR COOKIE BOX</div>
              <div className="tracking-items">{order.items.map((item) => <div className="tracking-item" key={item.cookieId}><span><b>{item.quantity} ×</b> {item.name}</span><span>{money(item.unitPriceCents * item.quantity)}</span></div>)}</div>
              {order.giftNote && <div className="tracking-gift"><Gift size={15} /><span>“{order.giftNote}”</span></div>}
              <div className="tracking-totals"><div><span>Subtotal</span><b>{money(order.subtotalCents)}</b></div><div><span>{order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</span><b>{order.deliveryFeeCents ? money(order.deliveryFeeCents) : 'Free'}</b></div><div><span>GST (10% included)</span><b>{money(order.gstCents)}</b></div><div className="tracking-total"><span>Total paid</span><b>{money(order.totalCents)}</b></div></div>
              <div className="tracking-destination"><MapPin size={15} /><span>{order.fulfillment === 'pickup' ? 'Bakehouse pickup' : `To ${order.suburb}`}</span><b>{order.speed === 'express' ? 'Express' : 'Standard'}</b></div>
              <Link href="/" className="button button-dark tracking-order-again" data-testid="link-order-again">Bake another box <ArrowRight size={15} /></Link>
            </aside>
          </div>}
    </main>
    <footer className="site-footer"><div className="page-wrap footer-inner"><span>Brisbane Cookie Co.</span><span>Thank you for choosing the gooey centre.</span><a href="/" data-testid="link-order-more">Order more</a></div></footer>
  </div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/order/:orderNumber" component={OrderTracking} />
      <Route component={NotFound} />
    </Switch>
  </ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter>
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>;
}

export default App;
/**
 * Long titles on a poster or an episode card scroll while the card is focused, as the Android app does:
 * the band widens to the full card and the text slides to its end and back.
 */
export function setMarquee(card, on) {
  const band = card.querySelector('.mv-card-band');
  const text = band && band.querySelector('em');
  if (!band || !text) return;
  if (!on) { band.classList.remove('marquee'); return; }
  // Measured once the band has taken its focused width
  requestAnimationFrame(() => {
    const room = band.querySelector('span').clientWidth;
    const over = text.offsetWidth - room;
    if (over > 2) {
      band.style.setProperty('--shift', `-${over}px`);
      band.style.setProperty('--dur', `${Math.max(3, over / 45 + 2.4)}s`);
      band.classList.add('marquee');
    } else band.classList.remove('marquee');
  });
}

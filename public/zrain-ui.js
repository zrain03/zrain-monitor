/**
 * Zrain UI 1.0.0
 * Shared, framework-free brand header/footer. No authentication or API logic.
 * The website owns its navigation unless a navigation array is provided.
 */
export const ZRAIN_HOME = "https://zrain.web.app";
export const ZRAIN_TAGLINE = "Made for people. Built with purpose.";

function element(doc, tag, classes, content) {
  const el = doc.createElement(tag);
  if (classes) el.className = classes;
  if (content !== undefined) el.textContent = content;
  return el;
}

function brandLogo(doc, src, className, size) {
  const img = element(doc, "img", className);
  img.src = src;
  img.alt = "";
  img.width = size;
  img.height = size;
  img.decoding = "async";
  return img;
}

function link(doc, href, classes, text) {
  const a = element(doc, "a", classes, text);
  a.href = href;
  return a;
}

/**
 * @param {object} config
 * @param {string} config.product - Name after "Zrain", e.g. "Links".
 * @param {string} config.logoSrc - Local path to the official Zrain logo.
 * @param {string} [config.productHref] - The current product's own homepage.
 * @param {string} [config.homeHref] - Main Zrain ecosystem destination.
 * @param {string} [config.tagline]
 * @param {{label:string,href:string,current?:boolean}[]} [config.navigation]
 * @param {{label:string,href:string,external?:boolean}[]} [config.footerLinks]
 * @param {Document} [config.document] - Optional test document.
 *
 * Replaces ONLY .zrain-brand and .zrain-footer__identity.
 * Navigation/authentication nodes remain unchanged unless navigation is supplied.
 */
export function mountZrainUI(config) {
  if (!config || typeof config.product !== "string" || !config.product.trim() ||
      typeof config.logoSrc !== "string" || !config.logoSrc.trim()) {
    throw new TypeError("Zrain UI requires product and logoSrc.");
  }
  const doc = config.document || document;
  const product = config.product.trim();
  const logoSrc = config.logoSrc;
  const homeHref = config.homeHref || ZRAIN_HOME;
  const productHref = config.productHref || "./";
  const tagline = config.tagline || ZRAIN_TAGLINE;

  const headerBrand = doc.querySelector(".zrain-header .zrain-brand");
  if (headerBrand) {
    const home = link(doc, homeHref, "zrain-brand__home");
    home.setAttribute("aria-label", "Zrain ecosystem home");
    home.append(
      brandLogo(doc, logoSrc, "brand-logo-image zrain-brand__logo", 42),
      element(doc, "strong", "zrain-brand__name", "Zrain")
    );
    const productLink = link(doc, productHref, "zrain-brand__product", product);
    productLink.setAttribute("aria-label", "Zrain " + product + " home");
    headerBrand.replaceChildren(home, productLink);
  }

  const footerBrand = doc.querySelector(".zrain-footer .zrain-footer__identity");
  if (footerBrand) {
    const home = link(doc, homeHref, "zrain-footer__home");
    home.setAttribute("aria-label", "Developed by Zrain. Open Zrain ecosystem home");
    const copy = element(doc, "span", "zrain-footer__copy");
    copy.append(
      element(doc, "strong", null, "Developed by Zrain"),
      element(doc, "small", null, tagline)
    );
    home.append(
      brandLogo(doc, logoSrc, "brand-logo-image zrain-footer__logo", 38),
      copy
    );
    footerBrand.replaceChildren(home);
  }

  // Existing apps can omit this to preserve their own state-driven menu items.
  if (Array.isArray(config.navigation)) {
    const nav = doc.querySelector(".zrain-header .topnav, .zrain-header .main-nav");
    if (nav) {
      const items = config.navigation.map(item => {
        const a = link(doc, item.href, item.current ? "current" : "", item.label);
        if (item.current) a.setAttribute("aria-current", "page");
        return a;
      });
      nav.replaceChildren(...items);
    }
  }
  if (Array.isArray(config.footerLinks)) {
    const footerLinks = doc.querySelector(".zrain-footer .zrain-footer__links");
    if (footerLinks) {
      const items = config.footerLinks.map(item => {
        const a = link(doc, item.href, "", item.label);
        if (item.external) {
          a.target = "_blank";
          a.rel = "noopener noreferrer";
        }
        return a;
      });
      footerLinks.replaceChildren(...items);
    }
  }
  return { product, homeHref, productHref, tagline };
}

import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { App } from "./App";
import { setServerPathname } from "./ui/routing";
import { publishedRates, posCurrencies, plans } from "./domain/pricing";
import { indexedPaths, notFoundSeo, pageSeo, prerenderedPaths, seoHeadMarkup, SITE_NAME, SITE_ORIGIN, SOCIAL_IMAGE } from "./seo";

/**
 * The build's server entry: tools/prerender.mjs loads this after `vite build`
 * and writes each marketing page out as static HTML. The tree is the same
 * `<App />` main.tsx hydrates, drawn before any session is known.
 */
export { indexedPaths, prerenderedPaths, SITE_ORIGIN };

export function renderPage(pathname: string): { body: string; head: string } {
  setServerPathname(pathname);
  const body = renderToString(<StrictMode><App /></StrictMode>);
  const seo = pathname === "/404" ? notFoundSeo : pageSeo(pathname);
  const structured = pathname === "/" || pathname === "/pricing" ? structuredData() : "";
  return { body, head: seoHeadMarkup(seo) + structured };
}

/** Organization and product markup, priced from the same rate card the pricing page uses. */
function structuredData(): string {
  const offers = posCurrencies.flatMap(currency => plans.map(plan => ({
    "@type": "Offer",
    name: plan === "monthly" ? "Monthly, per property" : "Annual, per property",
    price: (publishedRates[currency][plan] / 100).toFixed(2),
    priceCurrency: currency.toUpperCase(),
    url: `${SITE_ORIGIN}/pricing`
  })));
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE_ORIGIN}/#organization`, name: SITE_NAME, url: SITE_ORIGIN, logo: `${SITE_ORIGIN}/logo.jpg` },
      { "@type": "WebSite", "@id": `${SITE_ORIGIN}/#website`, name: SITE_NAME, url: SITE_ORIGIN, publisher: { "@id": `${SITE_ORIGIN}/#organization` } },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: pageSeo("/").description,
        image: SOCIAL_IMAGE,
        url: SITE_ORIGIN,
        publisher: { "@id": `${SITE_ORIGIN}/#organization` },
        offers
      }
    ]
  };
  return `\n    <script type="application/ld+json">${JSON.stringify(graph).replace(/</g, "\\u003c")}</script>`;
}

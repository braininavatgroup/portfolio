// Structural skeleton for the portfolio world. Everything here is layout,
// identity, and relationship data: record and thread IDs, families, registers,
// map positions, body-block ordering, visual metadata, and link topology.
// Every user-facing string lives in content/portfolio-content.json and is
// merged in by lib/portfolio-world.ts. IDs, positions, and block order
// are not part of the copy deck.

export type PortfolioWorldFamily =
  | "identity"
  | "story"
  | "operation"
  | "component"
  | "engagement"
  | "product";

export type PortfolioWorldRegister =
  | "identity"
  | "story"
  | "arc"
  | "warm"
  | "bridge"
  | "cool";

export type PortfolioRecordStatus = "active" | "past";
export type PortfolioOutlineType = "who" | "where" | "what" | "why";

export type PortfolioVisualTreatment =
  | "artifact"
  | "annotation"
  | "sequence"
  | "comparison"
  | "demo";

export type PortfolioVisualFormat = "image" | "video" | "gallery" | "interactive";

export type PortfolioVisualPreview = "quarterly-dashboard" | "campaign-report" | "touring";

/**
 * How a ready gallery lays its slides out inline. The default is the stacked
 * three-up / one-big rows; `carousel` renders each slide as one auto-scrolling
 * strip of assets, for marquee rows such as client logos.
 */
export type PortfolioVisualLayout = "carousel";

export type PortfolioVisualSourceStatus =
  | "exists"
  | "capture"
  | "redact"
  | "recreate"
  | "unknown";

export type PortfolioParagraphSkeleton = { kind: "paragraph"; id: string };

export type PortfolioCopyPlaceholderSkeleton = {
  kind: "copy-placeholder";
  id: string;
  questionIds?: readonly string[];
};

export type PortfolioVisualSkeleton = {
  kind: "visual";
  id: string;
  status: "planned" | "in-progress" | "ready";
  treatment?: PortfolioVisualTreatment;
  sourceStatus?: PortfolioVisualSourceStatus;
  format?: PortfolioVisualFormat;
  src?: string;
  muxPlaybackId?: string;
  frameSrc?: string;
  captionsSrc?: string;
  poster?: string;
  preview?: PortfolioVisualPreview;
  href?: string;
  layout?: PortfolioVisualLayout;
  slides?: readonly PortfolioVisualSlideSkeleton[];
};

export type PortfolioVisualAssetChrome = "mac-menu-bar";

/** Off-site addresses an asset's hover card links to, keyed by platform. */
export type PortfolioVisualAssetLinks = {
  instagram?: string;
  spotify?: string;
  beatport?: string;
};

export type PortfolioVisualSlideSkeleton = {
  assets: readonly {
    src: string;
    width?: number;
    height?: number;
    chrome?: PortfolioVisualAssetChrome;
    links?: PortfolioVisualAssetLinks;
  }[];
};

export type PortfolioBodyBlockSkeleton =
  | PortfolioParagraphSkeleton
  | PortfolioCopyPlaceholderSkeleton
  | PortfolioVisualSkeleton;

export type PortfolioRecordStructure = {
  id: string;
  family: PortfolioWorldFamily;
  register: PortfolioWorldRegister;
  outlineType: PortfolioOutlineType;
  position: { x: number; y: number; z: number };
  status?: PortfolioRecordStatus;
  summaryStatus?: "placeholder";
  body: readonly PortfolioBodyBlockSkeleton[];
};

export type PortfolioThreadStructure = {
  id: string;
  nodeId: string;
  body: readonly PortfolioBodyBlockSkeleton[];
  members: readonly string[];
};

const para = (id: string): PortfolioParagraphSkeleton => ({
  kind: "paragraph",
  id,
});

const readyGallery = (
  id: string,
  slides: readonly PortfolioVisualSlideSkeleton[],
): PortfolioVisualSkeleton => ({
  kind: "visual",
  id,
  status: "ready",
  treatment: "sequence",
  sourceStatus: "exists",
  format: "gallery",
  slides,
});

const readyCarousel = (
  id: string,
  slides: readonly PortfolioVisualSlideSkeleton[],
): PortfolioVisualSkeleton => ({
  kind: "visual",
  id,
  status: "ready",
  treatment: "artifact",
  sourceStatus: "exists",
  format: "gallery",
  layout: "carousel",
  slides,
});

const readyInteractive = (
  id: string,
  preview: PortfolioVisualPreview,
  href: string,
): PortfolioVisualSkeleton => ({
  kind: "visual",
  id,
  status: "ready",
  treatment: "demo",
  sourceStatus: "exists",
  format: "interactive",
  preview,
  href,
});

export const portfolioRecordStructures: readonly PortfolioRecordStructure[] = [
  {
    id: "bradley",
    outlineType: "who",
    family: "identity",
    register: "identity",
    position: { x: 48.88, y: 19.93, z: 646.71 },
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      para("p4"),
      para("p5"),
      para("p6"),
      para("p7"),
    ],
  },
  {
    id: "infamous",
    outlineType: "where",
    family: "operation",
    register: "warm",
    position: { x: -3.77, y: 53.24, z: 860 },
    status: "past",
    body: [
      para("p1"),
      readyCarousel("infamous-clients", [
        {
          assets: [
            {
              src: "/visuals/clients/infamous/all-day-i-dream.webp",
              links: { beatport: "https://www.beatport.com/label/all-day-i-dream/23038", instagram: "https://www.instagram.com/alldayidream/" },
            },
            {
              src: "/visuals/clients/infamous/aluna.webp",
              links: { spotify: "https://open.spotify.com/artist/5ITI6SEoUZMIXXkzCfr4oE", beatport: "https://www.beatport.com/artist/aluna/2282", instagram: "https://www.instagram.com/aluna/" },
            },
            {
              src: "/visuals/clients/infamous/blond-ish.webp",
              links: { spotify: "https://open.spotify.com/artist/6zsJjoCtL1WByG0VsuFWzR", beatport: "https://www.beatport.com/artist/blondish/154648", instagram: "https://www.instagram.com/blondish/" },
            },
            {
              src: "/visuals/clients/infamous/carl-craig.webp",
              links: { spotify: "https://open.spotify.com/artist/17dbJyUCrxh4I7iyUrjaHU", beatport: "https://www.beatport.com/artist/carl-craig/6460", instagram: "https://www.instagram.com/carlcraignet/" },
            },
            {
              src: "/visuals/clients/infamous/dirtybird.webp",
              links: { beatport: "https://www.beatport.com/label/dirtybird/619", instagram: "https://www.instagram.com/dirtybirdrecords/" },
            },
            {
              src: "/visuals/clients/infamous/dj-minx.webp",
              links: { spotify: "https://open.spotify.com/artist/4PTQtiKISN5iGNpbRVv02B", beatport: "https://www.beatport.com/artist/dj-minx/5599", instagram: "https://www.instagram.com/djminxwomenonwax/" },
            },
            {
              src: "/visuals/clients/infamous/fool-s-gold.webp",
              links: { beatport: "https://www.beatport.com/label/fools-gold-records/69555", instagram: "https://www.instagram.com/foolsgoldrecs/" },
            },
            {
              src: "/visuals/clients/infamous/hayden-james.webp",
              links: { spotify: "https://open.spotify.com/artist/4csQIMQm6vI2A2SCVDuM2z", beatport: "https://www.beatport.com/artist/hayden-james/341333", instagram: "https://www.instagram.com/haydenjames/" },
            },
            {
              src: "/visuals/clients/infamous/insomniac.webp",
              links: { beatport: "https://www.beatport.com/label/insomniac-records/63941", instagram: "https://www.instagram.com/insomniacrecs/" },
            },
            {
              src: "/visuals/clients/infamous/jayda-g.webp",
              links: { spotify: "https://open.spotify.com/artist/3NKVm2Jedcf6ibJr6pMUVx", beatport: "https://www.beatport.com/artist/jayda-g/500451", instagram: "https://www.instagram.com/jaydagmusic/" },
            },
            {
              src: "/visuals/clients/infamous/kasbo.webp",
              links: { spotify: "https://open.spotify.com/artist/1ikID9RZZMvkuBGDWrqajq", beatport: "https://www.beatport.com/artist/kasbo/372242", instagram: "https://www.instagram.com/kasbomusic/" },
            },
            {
              src: "/visuals/clients/infamous/kh-four-tet.webp",
              links: { spotify: "https://open.spotify.com/artist/7Eu1txygG6nJttLHbZdQOh", beatport: "https://www.beatport.com/artist/four-tet/15489", instagram: "https://www.instagram.com/fourtetkieran/" },
            },
            {
              src: "/visuals/clients/infamous/nez.webp",
              links: { spotify: "https://open.spotify.com/artist/2Mwy2BwAUT3WU1cZa3pvEW", beatport: "https://www.beatport.com/artist/nez-chicago/956289", instagram: "https://www.instagram.com/nezsoridiculous/" },
            },
            {
              src: "/visuals/clients/infamous/rose-ave.webp",
              links: { beatport: "https://www.beatport.com/label/rose-avenue/73321", instagram: "https://www.instagram.com/roseavenuerecords/" },
            },
            {
              src: "/visuals/clients/infamous/rufus-du-sol.webp",
              links: { spotify: "https://open.spotify.com/artist/5Pb27ujIyYb33zBqVysBkj", beatport: "https://www.beatport.com/artist/rufus-du-sol/580855", instagram: "https://www.instagram.com/rufusdusol/" },
            },
            {
              src: "/visuals/clients/infamous/sita-abellan.webp",
              links: { spotify: "https://open.spotify.com/artist/4Pi6eaHXMqift5xrs1vPMI", beatport: "https://www.beatport.com/artist/sita-abellan/1017620", instagram: "https://www.instagram.com/sitabellan/" },
            },
            {
              src: "/visuals/clients/infamous/totally-enormous-extinct-dinosaurs.webp",
              links: { beatport: "https://www.beatport.com/artist/teed/107135", instagram: "https://www.instagram.com/teedinosaurs/", spotify: "https://open.spotify.com/artist/0g3NiCRhEv7M4SEDMrpItN" },
            },
            {
              src: "/visuals/clients/infamous/ultra.webp",
              links: { beatport: "https://www.beatport.com/label/ultra/907", instagram: "https://www.instagram.com/ultrarecordsofficial/" },
            },
            {
              src: "/visuals/clients/infamous/young-art.webp",
              links: { beatport: "https://www.beatport.com/label/young-art-records/51330", instagram: "https://www.instagram.com/youngartrecords/" },
            },
            {
              src: "/visuals/clients/infamous/zeds-dead.webp",
              links: { spotify: "https://open.spotify.com/artist/67qogtRNI0GjUr8PlaG6Zh", beatport: "https://www.beatport.com/artist/zeds-dead/16768", instagram: "https://www.instagram.com/zedsdead/" },
            },
          ],
        },
      ]),
      para("p2"),
      para("p3"),
      para("p4"),
    ],
  },
  {
    id: "music-practice",
    outlineType: "where",
    family: "operation",
    register: "warm",
    position: { x: -2.73, y: 63.03, z: 890 },
    status: "active",
    body: [
      para("p1"),
      readyCarousel("music-practice-clients", [
        {
          assets: [
            {
              src: "/visuals/clients/adriatique.webp",
              links: { instagram: "https://www.instagram.com/adriatique/", spotify: "https://open.spotify.com/artist/02DWGcShQivFepRvGJ7xhB" },
            },
            {
              src: "/visuals/clients/align.webp",
              links: { instagram: "https://www.instagram.com/align_music/", spotify: "https://open.spotify.com/artist/4Yn4eqGITgZVZnOuRQNE2I" },
            },
            {
              src: "/visuals/clients/allizen.webp",
              links: { instagram: "https://www.instagram.com/allizen.wav/", spotify: "https://open.spotify.com/artist/66uo47lLBEU4tR7yyTvpKH" },
            },
            {
              src: "/visuals/clients/amal-nemer.webp",
              links: { instagram: "https://www.instagram.com/amal.nemer/", spotify: "https://open.spotify.com/artist/4dJbkK58s6mj9RGElqCNhm" },
            },
            {
              src: "/visuals/clients/ampersounds.webp",
              links: { instagram: "https://www.instagram.com/ampersounds/", spotify: "https://open.spotify.com/artist/37kgO7O0OonRq0zQ7WcWWl" },
            },
            {
              src: "/visuals/clients/arodes.webp",
              links: { instagram: "https://www.instagram.com/arodes_ofc/", spotify: "https://open.spotify.com/artist/4p2f8wUtltMAFuIJB4NR47" },
            },
            {
              src: "/visuals/clients/augusto-yepes.webp",
              links: { instagram: "https://www.instagram.com/augustoyepes1/", spotify: "https://open.spotify.com/artist/4Fii6zdHW1hbQw0LS4qeTs" },
            },
            {
              src: "/visuals/clients/awen.webp",
              links: { instagram: "https://www.instagram.com/awen_lkmusic", spotify: "https://open.spotify.com/artist/5uOaNXrr4qGx9YXbo9HaUl" },
            },
            {
              src: "/visuals/clients/bondo.webp",
              links: { instagram: "https://www.instagram.com/bondo.music/", spotify: "https://open.spotify.com/artist/6J4ESIo9lrm535gvZjFRvB" },
            },
            {
              src: "/visuals/clients/bounce-house.webp",
              links: { instagram: "https://www.instagram.com/bouncehouseforever/", spotify: "https://open.spotify.com/artist/3lp40W0O3FTQ5qIADxYI2G" },
            },
            {
              src: "/visuals/clients/calussa.webp",
              links: { instagram: "https://www.instagram.com/calussaofc/", spotify: "https://open.spotify.com/artist/0BlAuudg3BELkqP2nONKSW" },
            },
            {
              src: "/visuals/clients/chloecaillet.webp",
              links: { instagram: "https://www.instagram.com/chloecaillet/", spotify: "https://open.spotify.com/artist/68ywCN6ZpInbcilOfLBa3a" },
            },
            {
              src: "/visuals/clients/dwitches.webp",
              links: { instagram: "https://www.instagram.com/dwitchesofficial/", spotify: "https://open.spotify.com/artist/2qlBkJ7PtnKSLBwBfwBTpB" },
            },
            {
              src: "/visuals/clients/galo.webp",
              links: { instagram: "https://www.instagram.com/its.galo/", spotify: "https://open.spotify.com/artist/4v0KJDTlY8yFHSZAFmMj3L" },
            },
            {
              src: "/visuals/clients/kinahau.webp",
              links: { instagram: "https://www.instagram.com/kinahau_/", spotify: "https://open.spotify.com/artist/3C7Tv0IqIGLjA9rpVaeHRB" },
            },
            {
              src: "/visuals/clients/kino-todo.webp",
              links: { instagram: "https://www.instagram.com/kino_todo/", spotify: "https://open.spotify.com/artist/2kzHzn9DTankt1OfK1U8ol" },
            },
            {
              src: "/visuals/clients/lumia.webp",
              links: { instagram: "https://www.instagram.com/lumia.nocito/", spotify: "https://open.spotify.com/artist/7nxfxSbNTXNc0v5TG4ObSh" },
            },
            {
              src: "/visuals/clients/malone.webp",
              links: { instagram: "https://www.instagram.com/malonemusicofc/", spotify: "https://open.spotify.com/artist/7fQMET8UaHL3gpH9LhqINM" },
            },
            {
              src: "/visuals/clients/mia-moretti.webp",
              links: { instagram: "https://www.instagram.com/miamoretti/", spotify: "https://open.spotify.com/artist/508HEnl2cDRksyq8hyQtRh" },
            },
            {
              src: "/visuals/clients/notre-dame.webp",
              links: { instagram: "https://www.instagram.com/notredame.music/", spotify: "https://open.spotify.com/artist/6Q1Ps2F5LkdxLAM6S7KPpt" },
            },
            {
              src: "/visuals/clients/orsay.webp",
              links: { instagram: "https://www.instagram.com/orsaymusic/", spotify: "https://open.spotify.com/artist/0jbyfa9yocQWIf7nXO8LH4" },
            },
            {
              src: "/visuals/clients/port-london.webp",
              links: { spotify: "https://open.spotify.com/artist/4hvH07yUsAeYBO5KeyAefq" },
            },
            {
              src: "/visuals/clients/saintevie.webp",
              links: { instagram: "https://www.instagram.com/saintevieofficial/", spotify: "https://open.spotify.com/artist/30oVwXZSlElygdNpcUIFBk" },
            },
            {
              src: "/visuals/clients/saraga.webp",
              links: { instagram: "https://www.instagram.com/saragamusic/", spotify: "https://open.spotify.com/artist/68iQrOCMSJ2ThzXU1ELap6" },
            },
            {
              src: "/visuals/clients/satori.webp",
              links: { instagram: "https://www.instagram.com/satorimusica/", spotify: "https://open.spotify.com/artist/5nri3hyKmKBGAfvjBi0mK0" },
            },
            {
              src: "/visuals/clients/sidepiece.webp",
              links: { instagram: "https://www.instagram.com/youasidepiece/", spotify: "https://open.spotify.com/artist/5czbzNZZfWpyFgZyfT3Mkk" },
            },
            {
              src: "/visuals/clients/sosh-mosh.webp",
              links: { instagram: "https://www.instagram.com/soshmosh/", spotify: "https://open.spotify.com/artist/5eyJw0SeeTMFQKy9huXIHc" },
            },
            {
              src: "/visuals/clients/strawbry.webp",
              links: { instagram: "https://www.instagram.com/dj.strawbry/", spotify: "https://open.spotify.com/artist/6JcapcUefqZ2azH0T5BRSi" },
            },
            {
              src: "/visuals/clients/wmw.webp",
              links: { instagram: "https://www.instagram.com/whomadewhoofficial/", spotify: "https://open.spotify.com/artist/50Lr1puweM1hFsF1LpIZLM" },
            },
            {
              src: "/visuals/clients/willsass.webp",
              links: { instagram: "https://www.instagram.com/willsass/", spotify: "https://open.spotify.com/artist/1yCIbpGEKpVs3fZbGItAXc" },
            },
            {
              src: "/visuals/clients/yet-more.webp",
              links: { instagram: "https://www.instagram.com/yetmoremusic/", spotify: "https://open.spotify.com/artist/56brJyNkgCiv9ncSNkV99C" },
            },
            {
              src: "/visuals/clients/vision.webp",
              links: { instagram: "https://www.instagram.com/2020vision_recordings/", beatport: "https://www.beatport.com/label/2020-vision-recordings/9329" },
            },
            {
              src: "/visuals/clients/armada.webp",
              links: { instagram: "https://www.instagram.com/armadamusic/", beatport: "https://www.beatport.com/label/armada-music/33099" },
            },
            {
              src: "/visuals/clients/braslive.webp",
              links: { instagram: "https://www.instagram.com/braslive/", beatport: "https://www.beatport.com/label/braslive-records/18996" },
            },
            {
              src: "/visuals/clients/breakawayprojects.webp",
              links: { instagram: "https://www.instagram.com/bkwyprojects/", beatport: "https://www.beatport.com/label/breakaway/123742" },
            },
            {
              src: "/visuals/clients/hgsquare.webp",
              links: { instagram: "https://www.instagram.com/thehigherground/", beatport: "https://www.beatport.com/label/higher-ground/80998" },
            },
            {
              src: "/visuals/clients/le-yora.webp",
              links: { instagram: "https://www.instagram.com/leyora_collective/", beatport: "https://www.beatport.com/label/le-yora/109915" },
            },
            {
              src: "/visuals/clients/localvoid.webp",
              links: { instagram: "https://www.instagram.com/localvoidrecords/", beatport: "https://www.beatport.com/label/local-void/129124" },
            },
            {
              src: "/visuals/clients/nusonido.webp",
              links: { instagram: "https://www.instagram.com/nusonido/", beatport: "https://www.beatport.com/label/nusonido/130576" },
            },
            {
              src: "/visuals/clients/pop-tmrw.webp",
              links: { instagram: "https://www.instagram.com/pop_tmrw/", beatport: "https://www.beatport.com/label/pop-tomorrow/108464" },
            },
            {
              src: "/visuals/clients/shapelessculture.webp",
              links: { instagram: "https://www.instagram.com/shapeless_culture/", beatport: "https://www.beatport.com/label/shapeless-culture/106721" },
            },
            {
              src: "/visuals/clients/smiile.webp",
              links: { instagram: "https://www.instagram.com/smiilebychloe/", beatport: "https://www.beatport.com/label/smiile-records/124618" },
            },
            {
              src: "/visuals/clients/the-orchard.webp",
              links: { instagram: "https://www.instagram.com/the_orchard_/" },
            },
            {
              src: "/visuals/clients/wnu.webp",
              links: { instagram: "https://www.instagram.com/whynotusofc/", beatport: "https://www.beatport.com/label/whynotus/118584" },
            },
            {
              src: "/visuals/clients/x.webp",
              links: { instagram: "https://www.instagram.com/x___future/", beatport: "https://www.beatport.com/label/x-recordings/117694" },
            },
          ],
        },
      ]),
      para("p2"),
      para("p3"),
      para("p4"),
      para("p5"),
      para("p6"),
      para("p7"),
    ],
  },
  {
    id: "systems-consulting",
    outlineType: "where",
    family: "operation",
    register: "warm",
    position: { x: 40.83, y: 88.28, z: 920 },
    status: "active",
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      para("p4"),
    ],
  },
  {
    id: "product-studio",
    outlineType: "where",
    family: "operation",
    register: "warm",
    position: { x: 84.51, y: 79.99, z: 920 },
    status: "active",
    body: [
      para("p1"),
      para("p2"),
    ],
  },
  {
    id: "kickoff",
    outlineType: "what",
    family: "component",
    register: "bridge",
    position: { x: 2.66, y: 72.39, z: 920 },
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      para("p4"),
      {
        kind: "visual",
        id: "kickoff-sequence",
        status: "ready",
        treatment: "demo",
        sourceStatus: "exists",
        format: "video",
        src: "/visuals/campaign/campaign-kickoff-redacted.mp4",
        frameSrc: "/visuals/campaign/macbook-air-m5-13-midnight.png",
        captionsSrc: "/visuals/campaign/campaign-kickoff-captions.vtt",
        poster: "/visuals/campaign/campaign-kickoff-poster.png",
      },
    ],
  },
  {
    id: "pitching",
    outlineType: "what",
    family: "component",
    register: "bridge",
    position: { x: 14.1, y: 78.85, z: 860 },
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      {
        kind: "visual",
        id: "pitching-targeting-model",
        status: "ready",
        treatment: "demo",
        sourceStatus: "exists",
        format: "video",
        src: "/visuals/campaign/pitch-pipeline-preview.mp4",
        frameSrc: "/visuals/campaign/macbook-air-m5-13-midnight.png",
        captionsSrc: "/visuals/campaign/pitch-pipeline-captions.vtt",
        poster: "/visuals/campaign/pitch-pipeline-poster.png",
      },
      para("p4"),
      para("p5"),
    ],
  },
  {
    id: "reporting",
    outlineType: "what",
    family: "component",
    register: "bridge",
    position: { x: 26.28, y: 84.77, z: 890 },
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      para("p4"),
      readyGallery("reporting-workflow", [
        { assets: [{ src: "/visuals/campaign/reporting-result-workflow.png" }] },
      ]),
      para("p5"),
      readyGallery("reporting-email", [
        { assets: [{ src: "/visuals/campaign/reporting-drafts-2x.png" }] },
      ]),
      {
        ...readyInteractive(
          "reporting-dashboard",
          "campaign-report",
          "https://campaignreports.braininavat.dance/z8tfDu1OWgy9wN/",
        ),
        src: "/visuals/campaign/reporting-dashboard.png",
      },
    ],
  },
  {
    id: "real-estate",
    outlineType: "what",
    family: "engagement",
    register: "bridge",
    position: { x: 56.21, y: 86.84, z: 860 },
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      readyInteractive(
        "real-estate-quarterly-dashboard",
        "quarterly-dashboard",
        "/demos/quarterly-dashboard",
      ),
    ],
  },
  {
    id: "touring",
    outlineType: "what",
    family: "engagement",
    register: "bridge",
    position: { x: 71.04, y: 84.77, z: 890 },
    body: [
      para("p1"),
      para("p2"),
      readyInteractive("touring-work-sample", "touring", "/demos/touring"),
      para("p3"),
      para("p4"),
      para("p5"),
      para("p6"),
    ],
  },
  {
    id: "dubs",
    outlineType: "what",
    family: "product",
    register: "cool",
    position: { x: 93.03, y: 71.52, z: 860 },
    body: [
      para("p1"),
      para("p2"),
      readyGallery("dubs-loop", [
        {
          assets: [
            { src: "/visuals/dubs/lock-screen.png", width: 794, height: 1600 },
            { src: "/visuals/dubs/read-and-listen.png", width: 794, height: 1600 },
            { src: "/visuals/dubs/inline-note.png", width: 794, height: 1600 },
            { src: "/visuals/dubs/markup-in-context.png", width: 794, height: 1600 },
          ],
        },
        {
          assets: [
            { src: "/visuals/dubs/library.png", width: 794, height: 1600 },
            { src: "/visuals/dubs/tags.png", width: 794, height: 1600 },
            { src: "/visuals/dubs/perspective.png", width: 794, height: 1600 },
          ],
        },
        {
          assets: [
            { src: "/visuals/dubs/mcp.png", width: 794, height: 1600 },
          ],
        },
      ]),
      para("p3"),
      para("p4"),
    ],
  },
  {
    id: "writ",
    outlineType: "what",
    family: "product",
    register: "cool",
    position: { x: 100.06, y: 63.03, z: 890 },
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      readyGallery("writ-priority-behavior", [
        {
          assets: [
            { src: "/visuals/writ/output-priority.png", width: 600, height: 506, chrome: "mac-menu-bar" },
            { src: "/visuals/writ/input-priority.png", width: 600, height: 478, chrome: "mac-menu-bar" },
          ],
        },
        {
          assets: [
            { src: "/visuals/writ/device-rules.png", width: 600, height: 498, chrome: "mac-menu-bar" },
          ],
        },
        {
          assets: [
            { src: "/visuals/writ/keyboard-shortcuts.png", width: 600, height: 501 },
          ],
        },
      ]),
      para("p4"),
      para("p5"),
    ],
  },
  {
    id: "thread-making-work-playable",
    outlineType: "why",
    family: "story",
    register: "story",
    position: { x: 20.62, y: 43.99, z: 700 },
    body: [para("p1")],
  },
  {
    id: "thread-philosophy",
    outlineType: "why",
    family: "story",
    register: "story",
    position: { x: 77.04, y: 43.99, z: 700 },
    body: [para("p1"), para("p2")],
  },
] as const;

export type PortfolioFactualLinkStructure = {
  from: string;
  to: string;
  type: "direct" | "lineage";
};

export const portfolioFactualLinkStructures = [
  { from: "infamous", to: "music-practice", type: "lineage" },
  { from: "music-practice", to: "kickoff", type: "direct" },
  { from: "music-practice", to: "pitching", type: "direct" },
  { from: "music-practice", to: "reporting", type: "direct" },
  { from: "systems-consulting", to: "real-estate", type: "direct" },
  { from: "systems-consulting", to: "touring", type: "direct" },
  { from: "product-studio", to: "dubs", type: "direct" },
  { from: "product-studio", to: "writ", type: "direct" },
  { from: "kickoff", to: "pitching", type: "direct" },
  { from: "pitching", to: "reporting", type: "direct" },
] as const satisfies readonly PortfolioFactualLinkStructure[];

export const portfolioThreadStructures: readonly PortfolioThreadStructure[] = [
  {
    id: "making-work-playable",
    nodeId: "thread-making-work-playable",
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      para("p4"),
      para("p5"),
      para("p6"),
      para("p7"),
    ],
    members: [
      "kickoff",
      "pitching",
      "reporting",
      "real-estate",
      "touring",
      "dubs",
      "writ",
    ],
  },
  {
    id: "philosophy",
    nodeId: "thread-philosophy",
    body: [
      para("p1"),
      para("p2"),
      para("p3"),
      para("p4"),
      para("p5"),
      para("p6"),
      para("p7"),
      para("p8"),
    ],
    members: ["pitching", "reporting", "real-estate", "touring", "writ"],
  },
] as const;

export const portfolioContactStructure = {
  cvHref: "/cv/bradley-berkman-cv.pdf",
  socials: [
    { key: "linkedin", href: "https://www.linkedin.com/in/bradleyberkman/" },
    { key: "github", href: "https://github.com/bradleyberkman" },
    { key: "instagram", href: "https://www.instagram.com/bradley_berkman/" },
  ],
} as const;

export const SECTIONS = [
  {
    id: 'home',
    path: '/',
    label: 'Home',
    title: 'Mihir Sharma',
    paragraphs: [
      `Hi, I'm Mihir. I grew up in Seattle and attend UNC-Chapel Hill where I study CS & Math. I also spent a summer in Jaipur, India and a semester in Singapore, both of which cultivated my love for travel.`,

      `I'm currently an engineering intern @ Stripe where I work on an infrastructure team, and I've previously interned at Amazon. I'm interested in financial markets, startups, and hard tech. I value resilience, humility, and blitheness.`,

      `In my free time, I enjoy laughing with friends, fitness, making music, and broadening my horizons.`
    ]
  },
  {
    id: 'blog',
    path: '/blog',
    label: 'Blog',
    title: 'Blog',
    paragraphs: [
      `TBD`
    ]
  },
  {
    id: 'travel',
    path: '/travel',
    label: 'Travel',
    title: 'Travel',
    paragraphs: [
      `I love to travel. Going to India on a FLAS scholarship, as well as studying abroad at NUS in Singapore has greatly shaped my perspective and I'm always looking forward to my next destination.`,
      `Where I've been:`,
      [
        'Jaipur, India',
        'Singapore',
        'Kuala Lumpur, Malaysia',
        'Johor Bahru, Malaysia',
        'Da Nang, Vietnam',
        'Hoi An, Vietnam',
        'Bangkok, Thailand',
        'Phuket, Thailand',
        'Phi Phi Islands, Thailand',
        'Chiang Mai, Thailand',
        'Taipei, Taiwan',
        'Tokyo, Japan',
        'Milan, Italy',
        'Monza, Italy',
        'Turin, Italy',
        'Florence, Italy',
        'Rome, Italy',
        'Bolzano, Italy',
        'Renon, Italy',
        'Cinque Terre, Italy',
        'Lake Como, Italy',
        'Brixen, Italy',
        'Villnöß, Italy',
        'Merano, Italy'
      ],

      `Did I make this list by city name to inflate it? Yes ;)`,
      ' '
    ],
    links: {
      FLAS: 'https://en.wikipedia.org/wiki/Foreign_Language_Area_Studies'
    }
  },
  {
    id: 'whats-next',
    path: '/whats-next',
    label: "What's Next",
    title: "What's Next",
    paragraphs: [
      "Updated: Sept 7th 2026",
      { text: "I'm currently graduating in December 2026 and looking for startups to join.", bold: true },
      "I am optimizing for talent density, learning opportunities, and fun.",
      "Friends say I'm incredibly articulate, high agency, and an out of the box thinker :)",
      "If you are looking for someone of that description: contact me at mihirxsharma15[at]gmail[dot]com"
    ]
  },
  // Deliberately unlisted: reachable only by typing the path. The nav in
  // index.html is hand-written, so nothing here surfaces it.
  {
    id: 'quote',
    path: '/quote',
    label: 'Quote',
    title: 'Quote',
    quote: true,
    paragraphs: []
  }
];

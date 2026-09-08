// One of these is picked at random each time /qutoe loads. Wording and
// punctuation are kept exactly as written — quotation marks only appear on
// the ones that were quoted in the first place.
export const QUOTES = [
  `We can't add days to life but we can add life to days`,
  `You don't realize how high the shoulders of giants you stand on are until you look down`,
  `The best is yet to come`,
  `The whole point of life is to bite off more to chew and figure out how to chew it`,
  `"It doesn't make sense to continue wanting something if you aren't willing to do what it takes to get it; if u don't wanna live that lifestyle then release yourself from the desire. To crave the result but not the process is to guarantee disappointment"`,
  `An idiot in motion goes further than a genius at rest`,
  `I want to remember this ; u will`,
  `A bad man climbs the mountain so the world can see him; a good man climbs so he can see the world; a great man climbs so he can show others they can too.`,
  `To be a interesting person u have to be interested`,
  `Fortune favors the brave`,
  `“What do you plan to do with your one wild and precious life?”`,
  `If you listened to everyone who doubted you you wouldn't be here`,
  `If you don't fail you DIDNT even try`,
  `Embarrassment is an under explored emotion`,
  `Im not a winner not bc I win, it's because no loss ever made me a loser`,
  `If u wanan go fast, go alone. If u wanna go far, go with others`,
  `The amount of beautiful things u have in your life is depends on how much you notice them`,
  `Until death all defeat is psychological`,
  `Fear is loudest when you are closest to your desires`,
  `You can either be exist in the future or help build it`,
  `If you can't go a day without thinking about it, don't go a day without working for it.`,
  `He who suffers before it is necessary suffers more than is necessary`,
  `“Destiny is calling me” - Mr bright side`,
  `"When your disciplined, the days look the same; when your indisciplined, the years stay the same"`,
  `“This too shall pass”`
];

export function pickQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

import Section from '@/components/Section';

export const metadata = { title: 'Quote' };

// Deliberately unlisted: reachable only by typing the path, since the nav in
// Manuscript.jsx is hand-written and nothing here surfaces it.
const section = {
  id: 'quote',
  quote: true,
  paragraphs: []
};

export default function QuotePage() {
  return <Section section={section} />;
}

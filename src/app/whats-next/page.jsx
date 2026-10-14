import Section from '@/components/Section';

export const metadata = { title: "What's Next" };

const section = {
  id: 'whats-next',
  paragraphs: [
    "Updated: Sept 7th 2026",
    { text: "I'm currently graduating in December 2026 and looking for startups to join.", bold: true },
    "I am optimizing for talent density, learning opportunities, and fun.",
    "Friends say I'm incredibly articulate, high agency, and an out of the box thinker :)",
    "If you are looking for someone of that description: contact me at mihirxsharma15[at]gmail[dot]com"
  ]
};

export default function WhatsNextPage() {
  return <Section section={section} />;
}

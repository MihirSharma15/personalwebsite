import Section from '@/components/Section';

export const metadata = { title: "What's Next" };

const section = {
  id: 'whats-next',
  paragraphs: [
    "Updated: Nov 12th 2026",
    { text: "Building my own co. trying to solve friction in clinical trial recruitment", bold: true },
    "contact me at mihirxsharma15[at]gmail[dot]com"
  ]
};

export default function WhatsNextPage() {
  return <Section section={section} />;
}

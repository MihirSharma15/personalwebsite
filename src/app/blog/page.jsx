import Section from '@/components/Section';

export const metadata = { title: 'Blog' };

const section = {
  id: 'blog',
  paragraphs: [
    `TBD`
  ]
};

export default function BlogPage() {
  return <Section section={section} />;
}

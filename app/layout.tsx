import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(
    'https://wingspan-card-encyclopedia.whiteyin924.chatgpt.site',
  ),
  title: '展翅翱翔百科｜鸟卡与奖励卡查询',
  description:
    '快速搜索和筛选《展翅翱翔》核心版与快速入门鸟卡，查看中文能力、费用、栖息地、巢型及奖励卡详情。',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: '展翅翱翔百科｜鸟卡与奖励卡查询',
    description:
      '快速搜索和筛选核心版与快速入门鸟卡，查看完整中文能力与奖励卡详情。',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: '展翅翱翔百科——鸟卡与奖励卡查询',
      },
    ],
    locale: 'zh_CN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '展翅翱翔百科｜鸟卡与奖励卡查询',
    description:
      '快速搜索和筛选核心版与快速入门鸟卡，查看完整中文能力与奖励卡详情。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

import React from 'react';
import type { Metadata, Viewport } from 'next';
import 'bootstrap/dist/css/bootstrap-grid.min.css';
import '../src/styles/index.css';
import { AppLayout } from '../src/components/layout/AppLayout';

export const metadata: Metadata = {
  title: 'MinhLab | In 3D',
  description: 'MinhLab phục dựng những mẫu đồ chơi, mô hình đã ngừng sản xuất và cung cấp dịch vụ in 3D FDM và resin từ tệp thiết kế của bạn.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#101213',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="bg-background">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-[#F4F1EA] font-sans antialiased selection:bg-[#EB4037]/25 selection:text-[#F4F1EA] overflow-x-clip min-h-screen">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}

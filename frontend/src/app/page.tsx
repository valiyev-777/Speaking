'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import Link from 'next/link';

export default function Home() {
  const { isAuthenticated } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        {/* Logo / Brand */}
        <div className="mb-6">
          <span className="text-6xl">🎤</span>
        </div>
        
        <h1 className="text-5xl font-bold text-white mb-4">
          IELTS Speaking Partner
        </h1>
        <p className="text-xl text-primary-400 mb-2">
          O'zbekistonlik IELTS tayyorlanuvchilar uchun
        </p>
        <p className="text-lg text-slate-300 mb-8">
          Haqiqiy odamlar bilan ovozli suhbat orqali speaking mashq qiling. 
          Telegram kabi oddiy va tez!
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link
            href="/register"
            className="btn btn-primary text-lg px-8 py-3"
          >
            Ro'yxatdan o'tish
          </Link>
          <Link
            href="/login"
            className="btn btn-secondary text-lg px-8 py-3"
          >
            Kirish
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12">
          <div className="card">
            <div className="text-3xl mb-3">🎲</div>
            <h3 className="text-lg font-semibold text-white mb-2">Ruletka rejimi</h3>
            <p className="text-slate-400 text-sm">
              Tasodifiy sherik bilan bog'laning. Yangi odamlar bilan tanishing!
            </p>
          </div>
          
          <div className="card">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="text-lg font-semibold text-white mb-2">Daraja bo'yicha</h3>
            <p className="text-slate-400 text-sm">
              O'zingizga yaqin IELTS darajasidagi sherik bilan mashq qiling.
            </p>
          </div>
          
          <div className="card">
            <div className="text-3xl mb-3">🎤</div>
            <h3 className="text-lg font-semibold text-white mb-2">Faqat ovozli</h3>
            <p className="text-slate-400 text-sm">
              Kamera kerak emas! Telegram qo'ng'irog'i kabi oddiy ovozli aloqa.
            </p>
          </div>
          
          <div className="card">
            <div className="text-3xl mb-3">💬</div>
            <h3 className="text-lg font-semibold text-white mb-2">Matnli chat</h3>
            <p className="text-slate-400 text-sm">
              Gaplashish vaqtida so'zlarni yozib qo'yishingiz mumkin.
            </p>
          </div>
        </div>

        {/* Stats or social proof */}
        <div className="mt-12 pt-8 border-t border-slate-700">
          <p className="text-slate-400 mb-4">IELTS speaking band'ingizni oshiring</p>
          <div className="flex justify-center gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-primary-400">6.0-8.0</div>
              <div className="text-sm text-slate-500">Darajalar</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-400">5-15</div>
              <div className="text-sm text-slate-500">Daqiqa/session</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-yellow-400">100%</div>
              <div className="text-sm text-slate-500">Bepul</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useStore();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    current_level: 6.0,
    target_score: 7.0,
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await api.register(formData);
      setAuth(response.user, response.access_token);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ro\'yxatdan o\'tishda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('level') || name.includes('score') ? parseFloat(value) : value,
    }));
  };

  const levelOptions = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0];

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="text-center mb-6">
            <span className="text-4xl">🎤</span>
            <h1 className="text-2xl font-bold text-white mt-2">
              Ro'yxatdan o'tish
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              IELTS Speaking mashq qilishni boshlang
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="input"
                placeholder="email@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="username" className="label">Ism (nickname)</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="input"
                placeholder="Ismingiz"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="label">Parol</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="input"
                placeholder="Kamida 6 ta belgi"
                minLength={6}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="current_level" className="label">Hozirgi daraja</label>
                <select
                  id="current_level"
                  name="current_level"
                  value={formData.current_level}
                  onChange={handleChange}
                  className="input"
                >
                  {levelOptions.map(level => (
                    <option key={level} value={level}>
                      {level.toFixed(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="target_score" className="label">Maqsad ball</label>
                <select
                  id="target_score"
                  name="target_score"
                  value={formData.target_score}
                  onChange={handleChange}
                  className="input"
                >
                  {levelOptions.map(level => (
                    <option key={level} value={level}>
                      {level.toFixed(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn btn-primary py-3"
            >
              {isLoading ? 'Kuting...' : 'Ro\'yxatdan o\'tish'}
            </button>
          </form>

          <p className="mt-6 text-center text-slate-400 text-sm">
            Akkauntingiz bormi?{' '}
            <Link href="/login" className="text-primary-400 hover:text-primary-300">
              Kirish
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

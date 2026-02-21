'use client';

import { useEffect, useState } from 'react';

interface Analysis {
  id: number;
  filename: string;
  document_type: string;
  created_at: string;
  confidence_score: number;
  risk_count: number;
}

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const response = await fetch('https://docubot-production-043f.up.railway.app/api/history');
      const data = await response.json();
      
      if (data.status === 'success') {
        setAnalyses(data.analyses);
      } else {
        setError('Ошибка загрузки данных');
      }
    } catch (err) {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  }

  function getTypeName(type: string): string {
    const names: Record<string, string> = {
      contract: '📋 Договор',
      invoice: '📄 Счёт',
      act: '✅ Акт',
      other: '📁 Другое'
    };
    return names[type] || type;
  }

  function getRiskColor(count: number): string {
    if (count === 0) return 'text-green-500';
    if (count <= 2) return 'text-yellow-500';
    return 'text-red-500';
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">📊 История анализов</h1>

        {loading && (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
            <p className="mt-4 text-gray-400">Загрузка...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400">❌ {error}</p>
          </div>
        )}

        {!loading && !error && analyses.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-400">📭 История пуста</p>
            <a href="/" className="text-cyan-400 hover:underline mt-2 inline-block">
              Загрузить первый документ
            </a>
          </div>
        )}

        {!loading && !error && analyses.length > 0 && (
          <div className="space-y-4">
            {analyses.map((item) => (
              <div
                key={item.id}
                className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-cyan-500 transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">
                      {getTypeName(item.document_type)}
                    </h3>
                    <p className="text-gray-400 text-sm mb-3">{item.filename}</p>
                    
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-400">
                        📅 {new Date(item.created_at).toLocaleDateString('ru-RU')}
                      </span>
                      <span className="text-gray-400">
                        🎯 Уверенность: {(item.confidence_score * 100).toFixed(0)}%
                      </span>
                      <span className={getRiskColor(item.risk_count)}>
                        ⚠️ Рисков: {item.risk_count}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <a
            href="/"
            className="inline-block bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg transition"
          >
            ← На главную
          </a>
        </div>
      </div>
    </div>
  );
}
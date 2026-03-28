// frontend/components/StatsChart.tsx
'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'
import { Bar, Pie } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

interface StatsData {
  by_type: {
    contract: number
    invoice: number
    act: number
    other: number
  }
  avg_confidence: number
  total_risks: number
  total_documents: number
}

interface StatsChartProps {
  data: StatsData
}

export default function StatsChart({ data }: StatsChartProps) {
  // 📊 Бар-чарт: Документы по типам
  const barData = {
    labels: ['Договоры', 'Счета', 'Акты', 'Другие'],
    datasets: [
      {
        label: 'Документы',
        data: [
          data.by_type.contract || 0,
          data.by_type.invoice || 0,
          data.by_type.act || 0,
          data.by_type.other || 0,
        ],
        backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#64748b'],
        borderRadius: 6,
        borderWidth: 0,
      },
    ],
  }

  // 🥧 Pie-чарт: Уверенность AI
  const confidence = Math.round((data.avg_confidence || 0) * 100)
  const pieData = {
    labels: ['Уверенность', 'Неопределённость'],
    datasets: [
      {
        data: [confidence, 100 - confidence],
        backgroundColor: ['#22c55e', '#e2e8f0'],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { display: false },
        ticks: { stepSize: 1 },
      },
      x: {
        grid: { display: false },
      },
    },
  }

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.label}: ${context.raw}%`,
        },
      },
    },
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
      {/* 📊 Бар-чарт */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          📋 Документы по типам
        </h3>
        <div className="h-64">
          <Bar data={barData} options={barOptions} />
        </div>
        <div className="mt-4 flex justify-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span>Договоры</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span>Счета</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span>Акты</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-500"></div>
            <span>Другие</span>
          </div>
        </div>
      </div>

      {/* 🥧 Pie-чарт */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          🎯 Уверенность AI
        </h3>
        <div className="h-64 flex items-center justify-center">
          <div className="w-48 h-48">
            <Pie data={pieData} options={pieOptions} />
          </div>
        </div>
        <div className="text-center mt-4">
          <div className="text-4xl font-bold text-green-600 dark:text-green-400">
            {confidence}%
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            средняя уверенность анализа
          </div>
        </div>
      </div>

      {/* 📈 Доп. статистика */}
      <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="text-3xl font-bold">{data.total_documents || 0}</div>
          <div className="text-sm opacity-90">Всего документов</div>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
          <div className="text-3xl font-bold">{data.total_risks || 0}</div>
          <div className="text-sm opacity-90">Найдено рисков</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
          <div className="text-3xl font-bold">
            {data.total_documents ? Math.round((data.total_risks / data.total_documents) * 10) : 0}
          </div>
          <div className="text-sm opacity-90">Рисков на документ</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
          <div className="text-3xl font-bold">
            {data.by_type.contract || 0}
          </div>
          <div className="text-sm opacity-90">Договоров</div>
        </div>
      </div>
    </div>
  )
}
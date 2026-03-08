import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:10000';

export default function UserProfile({ token, onLogout }) {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, [token]);

  const fetchUserData = async () => {
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      // Получаем данные пользователя
      const userRes = await fetch(`${API_URL}/auth/me`, { headers });
      const userData = await userRes.json();
      setUser(userData);

      // Получаем статистику
      const statsRes = await fetch(`${API_URL}/api/stats`, { headers });
      const statsData = await statsRes.json();
      setStats(statsData);

      // Получаем историю
      const historyRes = await fetch(`${API_URL}/api/history?limit=5`, { headers });
      const historyData = await historyRes.json();
      setHistory(historyData.analyses || []);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>👤 Личный кабинет</h2>
        <div style={styles.buttons}>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            style={styles.toggleBtn}
          >
            {isExpanded ? '▲ Свернуть' : '▼ Развернуть'}
          </button>
          <button onClick={onLogout} style={styles.logoutBtn}>
            Выйти
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {user && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Профиль</h3>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Имя:</strong> {user.full_name || 'Не указано'}</p>
            </div>
          )}

          {stats && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>📊 Статистика</h3>
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statNumber}>{stats.total_documents}</div>
                  <div style={styles.statLabel}>Документов</div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statNumber}>{stats.avg_confidence}%</div>
                  <div style={styles.statLabel}>Точность</div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statNumber}>{stats.total_risks}</div>
                  <div style={styles.statLabel}>Рисков</div>
                </div>
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>📋 История анализов</h3>
              {history.map((item) => (
                <div key={item.id} style={styles.historyItem}>
                  <div>
                    <strong>{item.filename}</strong>
                    <div style={styles.meta}>
                      {new Date(item.created_at).toLocaleString('ru-RU')}
                    </div>
                  </div>
                  <div style={styles.badge}>
                    {item.document_type === 'contract' && '📄 Договор'}
                    {item.document_type === 'invoice' && '💰 Счёт'}
                    {item.document_type === 'act' && '✅ Акт'}
                    {item.document_type === 'application' && '📝 Заявление'}
                    {item.document_type === 'other' && '📑 Другое'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto 30px',
    padding: '2rem',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem'
  },
  title: {
    margin: 0,
    color: '#00d9ff'
  },
  buttons: {
    display: 'flex',
    gap: '10px'
  },
  toggleBtn: {
    padding: '8px 16px',
    background: 'rgba(0, 217, 255, 0.2)',
    border: '1px solid rgba(0, 217, 255, 0.5)',
    borderRadius: '6px',
    color: '#00d9ff',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  logoutBtn: {
    padding: '8px 16px',
    background: 'rgba(231, 76, 60, 0.2)',
    border: '1px solid rgba(231, 76, 60, 0.5)',
    borderRadius: '6px',
    color: '#e74c3c',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  section: {
    marginBottom: '2rem',
    padding: '1.5rem',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px'
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: '1rem',
    color: '#00ff88'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem'
  },
  statCard: {
    textAlign: 'center',
    padding: '1rem',
    background: 'rgba(0, 217, 255, 0.1)',
    borderRadius: '8px'
  },
  statNumber: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#00d9ff'
  },
  statLabel: {
    color: '#888',
    marginTop: '0.5rem',
    fontSize: '0.9rem'
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '6px',
    marginBottom: '0.5rem'
  },
  meta: {
    fontSize: '0.85rem',
    color: '#888',
    marginTop: '0.3rem'
  },
  badge: {
    padding: '0.3rem 0.8rem',
    background: 'rgba(0, 255, 136, 0.2)',
    borderRadius: '12px',
    fontSize: '0.85rem',
    color: '#00ff88'
  }
};
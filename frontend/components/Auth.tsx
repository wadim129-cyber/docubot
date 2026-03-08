'use client';
import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

const API_URL = 'http://localhost:10000';

interface AuthProps {
  onLogin: (token: string) => void;
  onClose: () => void;
}

export default function Auth({ onLogin, onClose }: AuthProps) {
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // Вход
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const response = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.detail || 'Неверный email или пароль');
        }

        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        onLogin(data.access_token);
        console.log('⏳ Setting timeout to close modal...');
        
        setTimeout(() => {
          setShowAuthModal(false);
        }, 100);

      } else {
        // Регистрация
        const response = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.detail || 'Ошибка регистрации');
        }

        alert('✅ Регистрация успешна! Теперь войдите');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <button onClick={onClose} style={styles.closeBtn}>✕</button>
      
      <h2 style={styles.title}>
        {isLogin ? '🔐 Вход' : '📝 Регистрация'}
      </h2>
      
      {error && <div style={styles.error}>{error}</div>}
      
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={styles.input}
        />
        
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
        />
        
        {!isLogin && (
          <input
            type="text"
            placeholder="Полное имя"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={styles.input}
          />
        )}
        
        <button 
          type="submit" 
          style={{
            ...styles.button,
            ...(loading ? styles.buttonDisabled : {})
          }}
          disabled={loading}
        >
          {loading ? '⏳ Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться')}
        </button>
      </form>
      
      <p style={styles.switch}>
        {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
        <button 
          onClick={() => setIsLogin(!isLogin)}
          style={styles.link}
        >
          {isLogin ? 'Зарегистрироваться' : 'Войти'}
        </button>
      </p>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    position: 'relative',
    background: '#1a1a2e',
    borderRadius: '15px',
    padding: '30px',
    maxWidth: '400px',
    width: '100%'
  },
  closeBtn: {
    position: 'absolute',
    top: '15px',
    right: '15px',
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '1.5em',
    cursor: 'pointer',
    width: '40px',
    height: '40px'
  },
  title: {
    color: '#00d9ff',
    textAlign: 'center',
    marginBottom: '20px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  input: {
    padding: '12px',
    border: '1px solid rgba(0, 217, 255, 0.3)',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'white',
    fontSize: '1em'
  },
  button: {
    padding: '12px',
    background: 'linear-gradient(90deg, #00d9ff, #00ff88)',
    border: 'none',
    borderRadius: '8px',
    color: '#1a1a2e',
    fontSize: '1em',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '10px'
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  error: {
    background: 'rgba(255, 0, 0, 0.2)',
    border: '1px solid rgba(255, 0, 0, 0.5)',
    color: '#ff6b6b',
    padding: '10px',
    borderRadius: '8px',
    marginBottom: '15px'
  },
  switch: {
    textAlign: 'center',
    marginTop: '15px',
    color: '#888'
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#00d9ff',
    cursor: 'pointer',
    marginLeft: '5px',
    textDecoration: 'underline'
  }
};
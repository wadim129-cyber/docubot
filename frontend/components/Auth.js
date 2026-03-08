import { useState } from 'react';

const API_URL = 'http://localhost:10000';

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        // Вход
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData
        });

        if (!res.ok) throw new Error('Неверный email или пароль');

        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        onLogin(data.access_token);
      } else {
        // Регистрация
        const res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName })
        });

        if (!res.ok) throw new Error('Ошибка регистрации');

        alert('✅ Регистрация успешна! Теперь войдите');
        setIsLogin(true);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={styles.container}>
      <h2>{isLogin ? '🔐 Вход' : '📝 Регистрация'}</h2>
      
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
        
        <button type="submit" style={styles.button}>
          {isLogin ? 'Войти' : 'Зарегистрироваться'}
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

const styles = {
  container: {
    maxWidth: '400px',
    margin: '2rem auto',
    padding: '2rem',
    background: '#1a1f2e',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  input: {
    padding: '0.8rem',
    border: '1px solid #2d3748',
    borderRadius: '6px',
    background: '#2d3748',
    color: 'white',
    fontSize: '1rem'
  },
  button: {
    padding: '0.8rem',
    background: 'linear-gradient(135deg, #00b894 0%, #00cec9 100%)',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '1rem',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  error: {
    background: '#e74c3c',
    color: 'white',
    padding: '0.8rem',
    borderRadius: '6px',
    marginBottom: '1rem'
  },
  switch: {
    textAlign: 'center',
    marginTop: '1rem',
    color: '#a0aec0'
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#00b894',
    cursor: 'pointer',
    marginLeft: '0.5rem',
    textDecoration: 'underline'
  }
};
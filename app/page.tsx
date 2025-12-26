'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
// --- SOLANA IMPORTS ---
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import {
  WalletModalProvider,
  WalletMultiButton,
} from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

// --- MAIN GAME LOGIC ---
function ScrollyGame() {
  const { publicKey } = useWallet();

  // --- STATE ---
  const [gameState, setGameState] = useState('START');
  const [score, setScore] = useState(0);
  const [diamonds, setDiamonds] = useState(0); // Current Run Gems
  const [totalDiamonds, setTotalDiamonds] = useState(0); // Banked Gems
  const [level, setLevel] = useState(1);
  const [topScores, setTopScores] = useState<{ addr: string; score: number }[]>(
    []
  );
  const [magicEffect, setMagicEffect] = useState('');
  const [shake, setShake] = useState(false);
  const [musicReady, setMusicReady] = useState(false);
  const [songName, setSongName] = useState('No Song Selected');
  const [hasShield, setHasShield] = useState(false);
  const [isGhost, setIsGhost] = useState(false);
  const [revived, setRevived] = useState(false);

  // --- SHOP STATE ---
  const [ownedSkins, setOwnedSkins] = useState<string[]>(['default']);
  const [equippedSkin, setEquippedSkin] = useState('default');

  // --- CONFIG ---
  const SKINS = [
    {
      id: 'default',
      name: 'Orbital One',
      price: 0,
      color: 'radial-gradient(circle at 30% 30%, #ffffff 0%, #cbd5e1 100%)',
      shape: '50%',
    },
    {
      id: 'crimson',
      name: 'Crimson Ace',
      price: 50,
      color: 'linear-gradient(135deg, #ef4444, #991b1b)',
      shape: '0%',
    },
    {
      id: 'gold',
      name: 'Golden Cube',
      price: 200,
      color: 'linear-gradient(135deg, #facc15, #ca8a04)',
      shape: '4px',
    },
    {
      id: 'neon',
      name: 'Neon Ghost',
      price: 500,
      color: 'transparent',
      border: '3px solid #d8b4fe',
      shape: '50%',
    },
  ];

  const THEMES = [
    {
      name: 'CLASSIC',
      bg: 'linear-gradient(180deg, #0f172a 0%, #334155 100%)',
      color: '#cbd5e1',
    },
    {
      name: 'OCEAN',
      bg: 'radial-gradient(circle at center, #1e3a8a 0%, #020617 100%)',
      color: '#3b82f6',
    },
    {
      name: 'TOXIC',
      bg: 'linear-gradient(180deg, #064e3b 0%, #022c22 100%)',
      color: '#4ade80',
    },
    {
      name: 'MAGMA',
      bg: 'linear-gradient(180deg, #7f1d1d 0%, #450a0a 100%)',
      color: '#f87171',
    },
    {
      name: 'CYBER',
      bg: 'radial-gradient(circle at center, #581c87 0%, #2e1065 100%)',
      color: '#d8b4fe',
    },
    {
      name: 'VOID',
      bg: 'radial-gradient(circle at center, #000000 0%, #1c1917 100%)',
      color: '#facc15',
    },
  ];

  // --- REFS ---
  const playerY = useRef(300);
  const playerX = useRef(0);
  const velocity = useRef(0);
  const scoreVal = useRef(0);
  const shieldActive = useRef(false);
  const ghostModeUntil = useRef(0);
  const speed = useRef(4);
  const startTime = useRef(0);
  const requestRef = useRef<any>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const diamondVal = useRef(0); // Tracks gems collected in THIS run

  // --- TUNING ---
  const START_SPEED = 4;
  const SPEED_INC = 0.2;
  const POINTS_PER_LEVEL = 100;
  const REVIVE_COST = 20;
  const currentTheme = THEMES[Math.min(level - 1, 5)];
  const GRAVITY = 0.6;
  const JUMP = -8.5;
  const PLAYER_SIZE = 28;
  const ROOF_LIMIT = 50;

  // --- SAVE SYSTEM ---
  useEffect(() => {
    // Load Data
    const savedScores = JSON.parse(
      localStorage.getItem('scrollyScoresSol') || '[]'
    );
    setTopScores(savedScores);
    const savedGems = parseInt(localStorage.getItem('scrollyGems') || '0');
    setTotalDiamonds(savedGems);
    const savedSkins = JSON.parse(
      localStorage.getItem('scrollySkins') || '["default"]'
    );
    setOwnedSkins(savedSkins);
    const savedEquip = localStorage.getItem('scrollyEquipped') || 'default';
    setEquippedSkin(savedEquip);
  }, []);

  const saveProgress = (finalScore: number, runGems: number) => {
    // 1. Update Leaderboard (With Wallet Address)
    const playerName = publicKey
      ? publicKey.toString().slice(0, 4) + '..' + publicKey.toString().slice(-4)
      : 'Guest';
    const newEntry = { addr: playerName, score: finalScore };
    const newScores = [...topScores, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    setTopScores(newScores);
    localStorage.setItem('scrollyScoresSol', JSON.stringify(newScores));

    // 2. Update Total Gems (Bank + Run)
    const newTotalGems = totalDiamonds + runGems;
    setTotalDiamonds(newTotalGems);
    localStorage.setItem('scrollyGems', newTotalGems.toString());
  };

  const buySkin = (skinId: string, price: number) => {
    if (totalDiamonds >= price && !ownedSkins.includes(skinId)) {
      const newTotal = totalDiamonds - price;
      setTotalDiamonds(newTotal);
      localStorage.setItem('scrollyGems', newTotal.toString());

      const newOwned = [...ownedSkins, skinId];
      setOwnedSkins(newOwned);
      localStorage.setItem('scrollySkins', JSON.stringify(newOwned));

      setEquippedSkin(skinId);
      localStorage.setItem('scrollyEquipped', skinId);
    } else if (ownedSkins.includes(skinId)) {
      setEquippedSkin(skinId);
      localStorage.setItem('scrollyEquipped', skinId);
    }
  };

  // --- AUDIO ---
  const handleFileUpload = (event: any) => {
    const file = event.target.files[0];
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      const audio = new Audio(fileUrl);
      audio.loop = true;
      audio.volume = 0.6;
      musicRef.current = audio;
      setSongName(file.name);
      setMusicReady(true);
    }
  };

  const playMusic = () => {
    if (musicRef.current) {
      if (musicRef.current.paused && musicRef.current.currentTime > 0) {
        musicRef.current.play().catch(() => {});
      } else {
        musicRef.current.currentTime = 0;
        musicRef.current.playbackRate = 1.0;
        musicRef.current.play().catch(() => {});
      }
    }
  };

  const pauseMusic = () => {
    if (musicRef.current) musicRef.current.pause();
  };
  const stopMusic = () => {
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current.currentTime = 0;
    }
  };

  // --- RENDER STATE ---
  const [renderY, setRenderY] = useState(300);
  const [renderX, setRenderX] = useState(0);
  const [hazards, setHazards] = useState<any[]>([]);
  const [coins, setCoins] = useState<any[]>([]);
  const [trail, setTrail] = useState<any[]>([]);

  // --- CONTROLS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'PLAYING') return;
      if (e.key === 'ArrowLeft') playerX.current -= 40;
      if (e.key === 'ArrowRight') playerX.current += 40;
      if (e.key === 'Escape') togglePause();
      if (playerX.current < -window.innerWidth / 2)
        playerX.current = -window.innerWidth / 2;
      if (playerX.current > window.innerWidth / 2)
        playerX.current = window.innerWidth / 2;
      setRenderX(playerX.current);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const handleJump = (e?: any) => {
    // --- BUG FIX: IGNORE CLICKS ON BUTTONS AND INPUTS ---
    if (
      e.target.closest &&
      (e.target.closest('button') || e.target.closest('input'))
    )
      return;

    if (e && e.cancelable) e.preventDefault();
    if (gameState === 'START' && musicReady) startGame();
    else if (gameState === 'PAUSED') togglePause();
    else if (gameState === 'PLAYING')
      if (playerY.current > ROOF_LIMIT + 10) velocity.current = JUMP;
  };

  const handleMove = (e: any) => {
    if (gameState !== 'PLAYING') return;
    if (e.cancelable) e.preventDefault();
    if (typeof window === 'undefined') return;
    let clientX;
    if (e.type.includes('touch') && e.touches && e.touches[0])
      clientX = e.touches[0].clientX;
    else clientX = e.clientX;
    if (clientX) {
      const centerX = window.innerWidth / 2;
      playerX.current = clientX - centerX;
      setRenderX(playerX.current);
    }
  };

  const startGame = () => {
    setGameState('PLAYING');
    setShake(false);
    playerY.current = 300;
    playerX.current = 0;
    velocity.current = JUMP;
    scoreVal.current = 0;
    speed.current = START_SPEED;
    startTime.current = Date.now();
    shieldActive.current = false;
    ghostModeUntil.current = 0;
    setHasShield(false);
    setIsGhost(false);
    setRevived(false);
    setRenderY(300);
    setRenderX(0);
    setHazards([]);
    setCoins([]);
    setTrail([]);
    setScore(0);
    setDiamonds(0);
    diamondVal.current = 0;
    setLevel(1);
    setMagicEffect('');
    playMusic();
  };

  const reviveGame = () => {
    if (totalDiamonds >= REVIVE_COST) {
      const newTotal = totalDiamonds - REVIVE_COST;
      setTotalDiamonds(newTotal);
      localStorage.setItem('scrollyGems', newTotal.toString());
      playerY.current = 300;
      velocity.current = JUMP;
      setHasShield(true);
      shieldActive.current = true;
      ghostModeUntil.current = Date.now() + 3000;
      setRevived(true);
      setGameState('PLAYING');
      setShake(false);
      setMagicEffect('REVIVED!');
      playMusic();
    }
  };

  const togglePause = () => {
    if (gameState === 'PLAYING') {
      setGameState('PAUSED');
      pauseMusic();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    } else if (gameState === 'PAUSED') {
      setGameState('PLAYING');
      if (musicRef.current) musicRef.current.play();
    }
  };

  const gameOver = () => {
    setGameState('GAME_OVER');
    setShake(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate)
      navigator.vibrate(400);
    stopMusic();

    // --- FIX: SYNC GEMS CORRECTLY ---
    saveProgress(scoreVal.current, diamondVal.current);

    // Reset Current Run Stats (Visually & Logically)
    setDiamonds(0);
    diamondVal.current = 0;

    if (requestRef.current) cancelAnimationFrame(requestRef.current);
  };

  const gameLoop = () => {
    if (gameState !== 'PLAYING') return;
    velocity.current += GRAVITY;
    playerY.current += velocity.current;

    if (playerY.current < ROOF_LIMIT) {
      playerY.current = ROOF_LIMIT;
      setRenderY(ROOF_LIMIT);
      gameOver();
      return;
    }
    if (playerY.current > window.innerHeight) {
      gameOver();
      return;
    }

    const currentLevel = 1 + Math.floor(scoreVal.current / POINTS_PER_LEVEL);
    if (currentLevel !== level) {
      setLevel(currentLevel);
      let zoneName =
        currentLevel <= 6
          ? 'CLASSIC ZONE'
          : currentLevel <= 12
          ? 'CRYSTAL ZONE'
          : currentLevel <= 18
          ? 'CYBER ZONE'
          : 'THE VOID';
      setMagicEffect(zoneName);
      setTimeout(() => setMagicEffect(''), 3000);
      if (musicRef.current) {
        let newRate = 1.0 + currentLevel * 0.03;
        if (newRate > 1.5) newRate = 1.5;
        musicRef.current.playbackRate = newRate;
      }
    }

    speed.current = START_SPEED + currentLevel * SPEED_INC;
    if (speed.current > 20) speed.current = 20;
    if (Date.now() < ghostModeUntil.current) setIsGhost(true);
    else setIsGhost(false);

    setTrail((prev) => {
      const newTrail = [
        ...prev,
        { x: playerX.current, y: playerY.current, id: Math.random() },
      ];
      if (newTrail.length > 6) newTrail.shift();
      return newTrail;
    });

    setHazards((prev) => {
      let next = prev
        .map((h) => ({ ...h, y: h.y + speed.current }))
        .filter((h) => h.y < window.innerHeight + 100);
      for (let i = 0; i < next.length; i++) {
        const h = next[i];
        if (Date.now() < ghostModeUntil.current) continue;
        let hitMargin = 6;
        if (
          Math.abs(playerY.current - h.y) <
          h.height / 2 + PLAYER_SIZE / 2 - hitMargin
        ) {
          if (
            Math.abs(playerX.current - h.x) <
            h.width / 2 + PLAYER_SIZE / 2 - hitMargin
          ) {
            if (shieldActive.current) {
              shieldActive.current = false;
              setHasShield(false);
              ghostModeUntil.current = Date.now() + 1500;
              setMagicEffect('SHIELD SAVED YOU!');
              if (typeof navigator !== 'undefined' && navigator.vibrate)
                navigator.vibrate(100);
              setTimeout(() => setMagicEffect(''), 1000);
            } else {
              gameOver();
              return next;
            }
          }
        }
      }

      if (Date.now() - startTime.current > 1000) {
        const last = next[next.length - 1];
        if (!last || last.y > 80) {
          let gapWidth = 220 - currentLevel * 5;
          if (gapWidth < 90) gapWidth = 90;
          const lastCenter = last ? last.gapCenter : 0;
          const maxShift = 40 + currentLevel * 5;
          let newCenter = lastCenter + Math.random() * maxShift * 2 - maxShift;
          if (newCenter > 130) newCenter = 130;
          if (newCenter < -130) newCenter = -130;
          const leftBlockWidth =
            window.innerWidth / 2 + newCenter - gapWidth / 2;
          const rightBlockWidth =
            window.innerWidth / 2 - newCenter - gapWidth / 2;
          const rowId = Math.random();
          let obsType = 'WALL';
          if (currentLevel > 6 && currentLevel <= 12) obsType = 'SHARD';
          if (currentLevel > 12 && currentLevel <= 18) obsType = 'SAW';
          if (currentLevel > 18) obsType = 'GLITCH';
          next.push({
            id: `L-${rowId}`,
            y: -60,
            height: 40,
            width: leftBlockWidth,
            x: -(window.innerWidth / 2) + leftBlockWidth / 2,
            gapCenter: newCenter,
            type: 'block',
            obstacleType: obsType,
          });
          next.push({
            id: `R-${rowId}`,
            y: -60,
            height: 40,
            width: rightBlockWidth,
            x: window.innerWidth / 2 - rightBlockWidth / 2,
            gapCenter: newCenter,
            type: 'block',
            obstacleType: obsType,
          });

          const rand = Math.random();
          if (rand > 0.96 && !shieldActive.current)
            setCoins((curr) => [
              ...curr,
              {
                id: `S-${rowId}`,
                y: -60,
                x: newCenter,
                type: 'shield',
                collected: false,
              },
            ]);
          else if (rand > 0.7)
            setCoins((curr) => [
              ...curr,
              {
                id: `C-${rowId}`,
                y: -60,
                x: newCenter,
                type: 'coin',
                collected: false,
              },
            ]);
          if (next.length % 10 === 0) {
            scoreVal.current += 1;
            setScore(scoreVal.current);
          }
        }
      }
      return next;
    });

    setCoins((prev) => {
      let next = prev
        .map((c) => ({ ...c, y: c.y + speed.current }))
        .filter((c) => c.y < window.innerHeight + 50 && !c.collected);
      next.forEach((c) => {
        const dist = Math.sqrt(
          Math.pow(playerX.current - c.x, 2) +
            Math.pow(playerY.current - c.y, 2)
        );
        if (dist < 35) {
          c.collected = true;
          if (c.type === 'shield') {
            shieldActive.current = true;
            setHasShield(true);
            setMagicEffect('SHIELD EQUIPPED');
            setTimeout(() => setMagicEffect(''), 1500);
          } else {
            scoreVal.current += 5;
            setScore(scoreVal.current);
            setDiamonds((d) => d + 1);
            diamondVal.current += 1;
            if (typeof navigator !== 'undefined' && navigator.vibrate)
              navigator.vibrate(50);
          }
        }
      });
      return next.filter((c) => !c.collected);
    });

    setRenderY(playerY.current);
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    if (gameState === 'PLAYING')
      requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState]);

  const activeSkin = SKINS.find((s) => s.id === equippedSkin) || SKINS[0];

  return (
    <div
      onMouseDown={handleJump}
      onMouseMove={handleMove}
      onTouchStart={handleJump}
      onTouchMove={handleMove}
      style={{
        width: '100vw',
        height: '100vh',
        background: currentTheme.bg,
        overflow: 'hidden',
        position: 'relative',
        cursor: 'crosshair',
        fontFamily: '"Segoe UI", Roboto, sans-serif',
        textAlign: 'center',
        userSelect: 'none',
        touchAction: 'none',
        color: 'white',
        transition: 'background 2s ease',
        animation: shake
          ? 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both'
          : 'none',
      }}
    >
      {/* WALLET BUTTON - TOP RIGHT */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 60 }}>
        <WalletMultiButton />
      </div>

      {/* HUD */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '95%',
          maxWidth: '600px',
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '10px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '1px solid rgba(255,255,255,0.2)',
          zIndex: 50,
        }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            togglePause();
          }}
          style={{ cursor: 'pointer', fontSize: '1.5rem', marginRight: 10 }}
        >
          {gameState === 'PAUSED' ? '▶️' : '⏸️'}
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>SCORE</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{score}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>LEVEL</div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: currentTheme.color,
            }}
          >
            {level}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>TOTAL GEMS</div>
          <div
            style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#facc15' }}
          >
            💎 {totalDiamonds + diamonds}
          </div>
        </div>
      </div>

      {magicEffect && (
        <div
          style={{
            position: 'absolute',
            top: 180,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            animation: 'pop 0.5s ease',
            zIndex: 60,
          }}
        >
          <h2
            style={{
              fontSize: '2rem',
              color: '#fff',
              margin: 0,
              textShadow: '0 0 20px rgba(255,255,255,0.5)',
            }}
          >
            {magicEffect}
          </h2>
        </div>
      )}

      {gameState === 'PAUSED' && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 70,
            background: 'rgba(0,0,0,0.8)',
            padding: '30px',
            borderRadius: 20,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <h1>PAUSED</h1>
          <p style={{ marginBottom: 20 }}>Click Play to Resume</p>
          <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
            Current Score: {score}
          </div>
        </div>
      )}

      {gameState === 'SHOP' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(15, 23, 42, 0.95)',
            zIndex: 80,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 80,
          }}
        >
          <h1 style={{ color: '#facc15', marginBottom: 10 }}>SKIN SHOP</h1>
          <div
            style={{ marginBottom: 30, fontSize: '1.5rem', fontWeight: 'bold' }}
          >
            💎 {totalDiamonds}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 20,
              maxWidth: 600,
            }}
          >
            {SKINS.map((skin) => {
              const isOwned = ownedSkins.includes(skin.id);
              const isEquipped = equippedSkin === skin.id;
              return (
                <div
                  key={skin.id}
                  onClick={() => buySkin(skin.id, skin.price)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    padding: 20,
                    borderRadius: 15,
                    border: isEquipped
                      ? '2px solid #4ade80'
                      : '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    width: 140,
                    textAlign: 'center',
                    opacity: !isOwned && totalDiamonds < skin.price ? 0.5 : 1,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      margin: '0 auto 15px auto',
                      background: skin.color,
                      borderRadius: skin.shape,
                      border: skin.border || 'none',
                    }}
                  />
                  <div style={{ fontWeight: 'bold', marginBottom: 5 }}>
                    {skin.name}
                  </div>
                  {isEquipped ? (
                    <div style={{ color: '#4ade80' }}>EQUIPPED</div>
                  ) : isOwned ? (
                    <div style={{ color: '#fff' }}>OWNED</div>
                  ) : (
                    <div style={{ color: '#facc15' }}>💎 {skin.price}</div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setGameState('START')}
            style={{
              marginTop: 40,
              padding: '15px 40px',
              fontSize: '1.2rem',
              background: '#38BDF8',
              border: 'none',
              borderRadius: 30,
              color: '#0f172a',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            BACK
          </button>
        </div>
      )}

      {gameState === 'START' && (
        <div
          style={{
            marginTop: 150,
            position: 'relative',
            zIndex: 60,
            padding: 20,
          }}
        >
          <h1
            style={{
              fontSize: '3rem',
              fontWeight: '900',
              textShadow: '0 5px 15px rgba(0,0,0,0.3)',
              marginBottom: 10,
            }}
          >
            ORBITAL RUSH
          </h1>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 10,
              marginBottom: 30,
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setGameState('SHOP');
              }}
              style={{
                padding: '10px 20px',
                borderRadius: 20,
                border: '1px solid #facc15',
                background: 'rgba(0,0,0,0.5)',
                color: '#facc15',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              🛒 SHOP
            </button>
          </div>
          <div style={{ marginBottom: 30 }}>
            <h3 style={{ margin: 0, color: '#facc15' }}>🏆 LEADERBOARD</h3>
            {topScores.length === 0 ? (
              <p style={{ opacity: 0.6 }}>No scores yet</p>
            ) : (
              topScores.map((s, i) => (
                <div key={i} style={{ fontSize: '1.2rem' }}>
                  #{i + 1}: {s.addr} - {s.score}
                </div>
              ))
            )}
          </div>
          {!musicReady ? (
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                padding: 30,
                borderRadius: 20,
                display: 'inline-block',
                backdropFilter: 'blur(5px)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <p style={{ fontSize: '1.2rem', marginBottom: 15 }}>
                🎵 Select "monkey.aac" to Start:
              </p>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                style={{ fontSize: '1rem', padding: 10 }}
              />
            </div>
          ) : (
            <div>
              <div
                style={{
                  color: '#4ade80',
                  fontSize: '1.2rem',
                  marginBottom: 20,
                  fontWeight: 'bold',
                }}
              >
                ✅ {songName} Loaded
              </div>
              <button
                onClick={startGame}
                style={{
                  background: 'linear-gradient(45deg, #facc15, #fbbf24)',
                  border: 'none',
                  padding: '15px 50px',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  borderRadius: '50px',
                  cursor: 'pointer',
                  boxShadow: '0 10px 30px rgba(251, 191, 36, 0.4)',
                  color: '#0f172a',
                }}
              >
                PLAY NOW
              </button>
              <p style={{ marginTop: 20, opacity: 0.7 }}>
                Tip: Use Arrow Keys or Touch to Move
              </p>
            </div>
          )}
        </div>
      )}

      {gameState === 'GAME_OVER' && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            padding: '40px',
            pointerEvents: 'auto',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            zIndex: 100,
            minWidth: '320px',
          }}
        >
          <h2
            style={{ color: '#ef4444', fontSize: '3rem', margin: '0 0 10px 0' }}
          >
            CRASHED
          </h2>
          <div
            style={{ fontSize: '1.2rem', color: '#94a3b8', marginBottom: 20 }}
          >
            Level Reached:{' '}
            <span style={{ color: 'white', fontWeight: 'bold' }}>{level}</span>
          </div>
          <div
            style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: 30 }}
          >
            Score: {score}
          </div>
          {!revived && totalDiamonds >= REVIVE_COST ? (
            <button
              onClick={reviveGame}
              style={{
                display: 'block',
                width: '100%',
                padding: '15px',
                marginBottom: 15,
                fontSize: '1.2rem',
                fontWeight: 'bold',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(90deg, #8b5cf6, #d946ef)',
                color: 'white',
                cursor: 'pointer',
                boxShadow: '0 5px 15px rgba(217, 70, 239, 0.4)',
              }}
            >
              💎 REVIVE ({REVIVE_COST})
            </button>
          ) : !revived ? (
            <div style={{ marginBottom: 15, opacity: 0.6, fontSize: '0.9rem' }}>
              Need {REVIVE_COST} Gems to Revive
            </div>
          ) : (
            <div
              style={{ marginBottom: 15, color: '#facc15', fontWeight: 'bold' }}
            >
              Revive Used
            </div>
          )}
          <button
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '1.2rem',
              cursor: 'pointer',
              borderRadius: '10px',
              border: 'none',
              background: '#38BDF8',
              color: '#0f172a',
              fontWeight: 'bold',
            }}
            onClick={() => setGameState('START')}
          >
            MAIN MENU
          </button>
        </div>
      )}

      {trail.map((t, i) => (
        <div
          key={t.id}
          style={{
            position: 'absolute',
            top: t.y,
            left: '50%',
            marginLeft: t.x - PLAYER_SIZE / 2,
            width: PLAYER_SIZE,
            height: PLAYER_SIZE,
            borderRadius: activeSkin.shape,
            background: hasShield
              ? '#60a5fa'
              : activeSkin.id === 'neon'
              ? 'transparent'
              : activeSkin.color,
            border: activeSkin.border || 'none',
            opacity: (i / 8) * 0.2,
            pointerEvents: 'none',
            transform: `scale(${i / 6})`,
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          top: renderY,
          left: '50%',
          marginLeft: renderX - PLAYER_SIZE / 2,
          width: PLAYER_SIZE,
          height: PLAYER_SIZE,
          borderRadius: activeSkin.shape,
          background: activeSkin.color,
          border: activeSkin.border || 'none',
          boxShadow: hasShield
            ? '0 0 30px #3b82f6'
            : '0 0 30px rgba(255,255,255,0.5)',
          zIndex: 20,
          opacity: isGhost ? 0.5 : 1,
          animation: isGhost ? 'flash 0.1s infinite' : 'none',
        }}
      />
      {hasShield && (
        <div
          style={{
            position: 'absolute',
            top: renderY - 8,
            left: '50%',
            marginLeft: renderX - PLAYER_SIZE / 2 - 8,
            width: PLAYER_SIZE + 16,
            height: PLAYER_SIZE + 16,
            borderRadius: '50%',
            border: '2px solid #60a5fa',
            opacity: 0.8,
            boxShadow: '0 0 20px #60a5fa',
            animation: 'spin 3s infinite linear',
          }}
        />
      )}

      {hazards.map((h) => (
        <div
          key={h.id}
          style={{
            position: 'absolute',
            top: h.y,
            left: '50%',
            marginLeft: h.x - h.width / 2,
            width: h.width,
            height: h.height,
            background: `linear-gradient(135deg, ${currentTheme.color} 0%, rgba(255,255,255,0.2) 100%)`,
            borderRadius:
              h.obstacleType === 'WALL'
                ? '4px'
                : h.obstacleType === 'SHARD'
                ? h.id.includes('L')
                  ? '0 50% 50% 0'
                  : '50% 0 0 50%'
                : '50%',
            border:
              h.obstacleType === 'SAW'
                ? `2px dashed ${currentTheme.color}`
                : 'none',
            boxShadow: `0 0 15px ${currentTheme.color}`,
            animation:
              h.obstacleType === 'SAW' ? 'spin 1s infinite linear' : 'none',
          }}
        />
      ))}

      {coins.map((c) => (
        <div
          key={c.id}
          style={{
            position: 'absolute',
            top: c.y,
            left: '50%',
            marginLeft: c.x - 15,
            width: 30,
            height: 30,
            // --- SHAPE FIX ---
            clipPath:
              c.type === 'coin'
                ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
                : 'polygon(10% 0, 90% 0, 100% 60%, 50% 100%, 0 60%)',
            background:
              c.type === 'coin'
                ? 'linear-gradient(135deg, #facc15, #ca8a04)'
                : 'linear-gradient(180deg, #60a5fa, #2563eb)',
            zIndex: 10,
            boxShadow:
              c.type === 'coin' ? '0 0 15px #facc15' : '0 0 20px #3b82f6',
            animation: 'float 2s infinite ease-in-out',
          }}
        />
      ))}

      <style jsx global>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-5px); } 100% { transform: translateY(0px); } }
        @keyframes pop { 0% { transform: translateX(-50%) scale(0); } 80% { transform: translateX(-50%) scale(1.1); } 100% { transform: translateX(-50%) scale(1); } }
        @keyframes shake { 10%, 90% { transform: translate3d(-1px, 0, 0); } 20%, 80% { transform: translate3d(2px, 0, 0); } 30%, 50%, 70% { transform: translate3d(-4px, 0, 0); } 40%, 60% { transform: translate3d(4px, 0, 0); } }
        @keyframes flash { 0% { opacity: 1; } 50% { opacity: 0.2; } 100% { opacity: 1; } }
      `}</style>
    </div>
  );
}

// --- SOLANA WRAPPER (FIXED EXPORT) ---
export default function GamePage() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ScrollyGame />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

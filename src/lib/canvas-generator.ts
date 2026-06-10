import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import fs from 'fs';

// Register local Arial fonts to ensure consistent rendering across all platforms (Windows/Linux/Vercel)
const fontsDir = path.join(process.cwd(), 'public', 'fonts');
const arialPath = path.join(fontsDir, 'arial.ttf');
const arialBoldPath = path.join(fontsDir, 'arialbd.ttf');

if (fs.existsSync(arialPath)) {
  registerFont(arialPath, { family: 'Arial', weight: 'normal' });
}
if (fs.existsSync(arialBoldPath)) {
  registerFont(arialBoldPath, { family: 'Arial', weight: 'bold' });
}


interface DrawMatchParams {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  status: string;
  minute?: number | null;
  stage?: string;
}

export async function generateMatchCardImage(params: DrawMatchParams): Promise<Buffer> {
  const { homeTeamName, awayTeamName, homeScore, awayScore, status, minute, stage = 'GROUP STAGE' } = params;

  // 1. Create a canvas of 800x450 (16:9 ratio)
  const canvas = createCanvas(800, 450);
  const ctx = canvas.getContext('2d');

  // 2. Load background image (randomly select from bg-1.jpg to bg-5.jpg)
  const publicDir = path.join(process.cwd(), 'public');
  const backgroundsDir = path.join(publicDir, 'backgrounds');
  let bgPath = path.join(publicDir, 'match-center-bg.png');

  try {
    if (fs.existsSync(backgroundsDir)) {
      const files = fs.readdirSync(backgroundsDir).filter(f => f.startsWith('bg-') && (f.endsWith('.jpg') || f.endsWith('.png')));
      if (files.length > 0) {
        const randomFile = files[Math.floor(Math.random() * files.length)];
        bgPath = path.join(backgroundsDir, randomFile);
      }
    }
  } catch (err) {
    console.error('Failed to read backgrounds directory, using default:', err);
  }

  
  try {
    if (fs.existsSync(bgPath)) {
      const bgImage = await loadImage(bgPath);
      ctx.drawImage(bgImage, 0, 0, 800, 450);
    } else {
      // Fallback solid gradient if background doesn't exist
      const gradient = ctx.createLinearGradient(0, 0, 0, 450);
      gradient.addColorStop(0, '#18181b'); // zinc-900
      gradient.addColorStop(1, '#09090b'); // zinc-950
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 450);
    }
  } catch (err) {
    console.error('Failed to load canvas background image, using fallback:', err);
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, 800, 450);
  }

  // 3. Draw dark gradient overlay (like the UI design)
  ctx.fillStyle = 'rgba(9, 9, 11, 0.65)'; // zinc-950 with 65% opacity
  ctx.fillRect(0, 0, 800, 450);

  // Draw neobrutalist border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 12;
  ctx.strokeRect(0, 0, 800, 450);

  // 4. Header metadata
  ctx.fillStyle = '#B6FF3B'; // Neon green
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(stage.toUpperCase(), 400, 50);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText('MATCH CENTER', 400, 85);

  // Draw thin divider line
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(30, 110);
  ctx.lineTo(770, 110);
  ctx.stroke();

  // 5. Home Team (Left side)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px Arial, sans-serif';
  ctx.textAlign = 'center';
  
  // Wrap or truncate long team names
  const maxTeamNameWidth = 280;
  const drawTruncatedText = (text: string, x: number, y: number) => {
    let display = text.toUpperCase();
    if (ctx.measureText(display).width > maxTeamNameWidth) {
      while (ctx.measureText(display + '...').width > maxTeamNameWidth && display.length > 0) {
        display = display.slice(0, -1);
      }
      display += '...';
    }
    ctx.fillText(display, x, y);
  };
  
  drawTruncatedText(homeTeamName, 220, 240);

  // 6. Away Team (Right side)
  drawTruncatedText(awayTeamName, 580, 240);

  // 7. Score (Center)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 72px Arial, sans-serif';
  ctx.textAlign = 'center';
  
  // Text shadow effect (neobrutalist style)
  const scoreText = `${homeScore} : ${awayScore}`;
  ctx.fillStyle = '#000000';
  ctx.fillText(scoreText, 400 + 4, 250 + 4);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(scoreText, 400, 250);

  // 8. Match Status/Minute (Center under score)
  let statusText = '';
  let statusColor = '#A1A1AA'; // zinc-400
  
  if (status === 'live') {
    statusText = `LIVE • ${minute || 0}'`;
    statusColor = '#EF4444'; // red-500
  } else if (status === 'finished') {
    statusText = 'FULL TIME';
    statusColor = '#A1A1AA';
  } else {
    statusText = 'SCHEDULED';
    statusColor = '#FF3366'; // pink-500
  }

  ctx.fillStyle = statusColor;
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText(statusText, 400, 310);

  // 9. Footer Brand Info
  ctx.fillStyle = '#71717A'; // zinc-500
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText('WORLDCUPX 2026 PORTAL', 400, 410);

  return canvas.toBuffer('image/png');
}

interface DrawPredictionParams {
  username: string;
  question: string;
  choice: string;
  stake: number;
  avgPrice: number;
  potentialPayout?: number;
}

export async function generatePredictionCardImage(params: DrawPredictionParams): Promise<Buffer> {
  const { username, question, choice, stake, avgPrice, potentialPayout } = params;

  // Create 800x450 canvas
  const canvas = createCanvas(800, 450);
  const ctx = canvas.getContext('2d');

  // Load backgrounds/bg-1.jpg
  const publicDir = path.join(process.cwd(), 'public');
  const bgPath = path.join(publicDir, 'backgrounds', 'bg-1.jpg');
  
  try {
    if (fs.existsSync(bgPath)) {
      const bgImage = await loadImage(bgPath);
      ctx.drawImage(bgImage, 0, 0, 800, 450);
    } else {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, 800, 450);
    }
  } catch (err) {
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, 800, 450);
  }

  // Dark gradient overlay
  ctx.fillStyle = 'rgba(9, 9, 11, 0.75)'; 
  ctx.fillRect(0, 0, 800, 450);

  // Border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 12;
  ctx.strokeRect(0, 0, 800, 450);

  // Header
  ctx.fillStyle = '#FF3366'; // Pink
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ACTIVE PREDICTION CONTRACT', 400, 50);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText(`PREDICTED BY: @${username.toUpperCase()}`, 400, 85);

  // Divider
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(30, 110);
  ctx.lineTo(770, 110);
  ctx.stroke();

  // Market Question
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'center';
  
  const maxQuestionWidth = 700;
  let qText = question.toUpperCase();
  if (ctx.measureText(qText).width > maxQuestionWidth) {
    const words = qText.split(' ');
    let line1 = '';
    let line2 = '';
    for (const word of words) {
      if (ctx.measureText(line1 + word).width < maxQuestionWidth && line2 === '') {
        line1 += word + ' ';
      } else {
        line2 += word + ' ';
      }
    }
    ctx.fillText(line1.trim(), 400, 160);
    if (line2) ctx.fillText(line2.trim(), 400, 200);
  } else {
    ctx.fillText(qText, 400, 180);
  }

  // Box for Choice
  ctx.fillStyle = '#000000';
  ctx.fillRect(150, 240, 500, 80);
  ctx.strokeStyle = '#B6FF3B';
  ctx.lineWidth = 4;
  ctx.strokeRect(150, 240, 500, 80);

  ctx.fillStyle = '#B6FF3B'; 
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText('YOUR CHOICE', 400, 260);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.fillText(choice.toUpperCase(), 400, 300);

  // Stats
  ctx.fillStyle = '#A1A1AA';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`STAKE: ${stake} WCX`, 150, 370);
  ctx.fillText(`AVG PRICE: ${avgPrice.toFixed(2)}`, 150, 400);

  ctx.textAlign = 'right';
  const payoutVal = potentialPayout || (stake * (1 / avgPrice));
  ctx.fillStyle = '#B6FF3B';
  ctx.fillText(`POTENTIAL PAYOUT: ${payoutVal.toFixed(0)} WCX`, 650, 370);

  ctx.fillStyle = '#71717A';
  ctx.fillText('WORLDCUPX 2026', 650, 400);

  return canvas.toBuffer('image/png');
}

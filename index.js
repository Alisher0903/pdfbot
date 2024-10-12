require('dotenv').config();

const {Telegraf, Markup} = require('telegraf');
const fs = require('fs');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const express = require('express');
const path = require('path');
const ONE_TOKEN="6989077644:AAFfpFi5ofIddWsnyT82SzVQPE3ZQwKKuyM"
const TWO_TOKEN="7707863603:AAFbEfe64qM_ReMM08WJ4saAtWiwHpE1EDw"

// Telegram bot token
const bot = new Telegraf(ONE_TOKEN);

// Express server
const app = express();
app.use(bot.webhookCallback('/bot'));

// Vercel uchun webhook URL ni sozlash
bot.telegram.setWebhook(`https://pdf-bot.vercel.app/bot`);

// "images" papkasini tekshirish va yaratish
const createImagesFolder = () => {
    const dir = './images';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
};

// Papkani va ichidagi fayllarni o'chirish
const deleteFolderRecursive = (folderPath) => {
    if (fs.existsSync(folderPath)) {
        fs.readdirSync(folderPath).forEach((file) => {
            const curPath = path.join(folderPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath); // Recursive o'chirish
            } else {
                fs.unlinkSync(curPath); // Faylni o'chirish
            }
        });
        fs.rmdirSync(folderPath); // Papkani o'chirish
    }
};

// Bot "start" komandasi
bot.start((ctx) => {
    const username = ctx.from.username
        ? `<a href="https://t.me/${ctx.from.username}">${ctx.from.first_name}</a>`
        : ctx.from.first_name;
    const botname = ctx.botInfo.first_name;
    const botUsername = ctx.botInfo.username;
    ctx.replyWithHTML(
        `Assalomu alaykum ${username}. Bizning <a href="https://t.me/${botUsername}">${botname}</a> botimizga xush kelibsiz! Menga rasm jo'natib tez va oson PDF ga aylantiring.`,
        Markup.keyboard(['Image to PDF']).oneTime().resize()
    );
});

// Rasm qabul qilish
const images = {};
bot.on('photo', async (ctx) => {
    createImagesFolder(); // "images" papkasini yaratish
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const fileUrl = await ctx.telegram.getFileLink(fileId);
    const chatId = ctx.chat.id;

    if (!images[chatId]) images[chatId] = [];
    if (images[chatId].length === 0)
        ctx.reply('Rasm qabul qilindi. Rasmlarni junatib bo\'lganingizdan so\'ng "Image to PDF" tugmasini bosing.');

    const filePath = `./images/${chatId}-${Date.now()}.jpg`;
    const response = await axios.get(fileUrl, {responseType: 'arraybuffer'});
    fs.writeFileSync(filePath, response.data);
    images[chatId].push(filePath);
});

// PDF yaratuvchi tugma
const step = {};
bot.hears('Image to PDF', (ctx) => {
    const chatId = ctx.chat.id;

    if (!images[chatId] || images[chatId].length === 0)
        return ctx.reply('Siz hech qanday rasm yubormadingiz.');

    step[chatId] = 'awaiting_filename';
    ctx.reply('Iltimos, PDF uchun fayl nomini kiriting:');
});

// Fayl nomini qabul qilish va PDF yaratish
bot.on('text', async (ctx) => {
    const chatId = ctx.chat.id;

    if (!images[chatId] || images[chatId].length === 0)
        return ctx.reply('Siz hech qanday rasm yubormadingiz.');
    if (step[chatId] === undefined) {
        ctx.deleteMessage(ctx.message.message_id)
            .then(() => ctx.reply('Xabarlarga ruxsat yo\'q.'))
            .catch((err) => console.error('Xabarni o\'chirishda xatolik:', err));
        return;
    }

    if (step[chatId] === 'awaiting_filename') {
        const filename = ctx.message.text.trim();

        if (!filename) return ctx.reply('Fayl nomi noto‘g‘ri. Yaroqli fayl nomini kiriting:');
        await ctx.reply('So‘rovingiz ko‘rib chiqilmoqda, kuting...');

        const doc = new PDFDocument({autoFirstPage: false});
        const pdfPath = `./${filename}.pdf`;
        doc.pipe(fs.createWriteStream(pdfPath));

        try {
            for (const imagePath of images[chatId]) {
                const img = doc.openImage(imagePath);

                doc.addPage({size: [img.width, img.height]});
                doc.image(imagePath, 0, 10, {width: img.width, height: img.height});
            }

            doc.end();

            await ctx.replyWithChatAction('upload_document');
            await ctx.replyWithDocument({source: pdfPath});

            fs.unlinkSync(pdfPath); // PDF faylni o'chirish
            deleteFolderRecursive('./images'); // Papkani o'chirish
            images[chatId] = [];
            ctx.replyWithHTML('File muvaffaqiyatli yuklandi✔.');
            delete step[chatId];
        } catch (error) {
            console.error(error);
            ctx.reply('Kechirasiz, PDF yaratishda xatolik yuz berdi.');
        }
    }
});

// Express serverni ishga tushirish
app.listen(3000, () => {
    console.log('Bot is running with Webhook...');
});

// Processni to‘xtatish
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

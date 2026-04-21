<?php
/**
 * Экспорт биографий (CPT "lico") + таксономии (lico_cat) + медиа
 * из WordPress-сайта lichnosty.ru в один JSON-файл.
 *
 * Запуск:
 *   1. Положите этот файл в корень сайта (/www/lichnosty.ru/export-lico.php)
 *      через ispmgr → Менеджер файлов или FTP.
 *   2. Откройте в браузере: https://lichnosty.ru/export-lico.php?key=<SECRET>
 *      где <SECRET> — значение EXPORT_SECRET ниже. Задайте собственное!
 *   3. Результат сохранится рядом: /www/lichnosty.ru/lico_export.json
 *   4. Скачайте JSON через Менеджер файлов и положите в репозиторий:
 *      migration/db/lico_export.json
 *   5. УДАЛИТЕ этот скрипт с хостинга сразу после экспорта.
 *
 * Что собирает:
 *   - Все посты post_type='lico' (публичные + черновики — по флагу below)
 *   - Все meta-поля (_elementor_data, кастомные поля биографии)
 *   - Таксономию lico_cat (категории)
 *   - Thumbnails и прикреплённые изображения (URL-ы)
 *   - Список всех файлов в /wp-content/uploads (относительные пути)
 */

// ==== НАСТРОЙКИ (отредактируйте перед запуском) ====
define('EXPORT_SECRET',  'ЗАМЕНИТЕ-МЕНЯ-НА-СЛУЧАЙНУЮ-СТРОКУ');
define('INCLUDE_DRAFTS', false);      // true — экспортировать черновики и приватные
define('INCLUDE_UPLOADS_INDEX', true); // true — собрать листинг uploads/
define('OUTPUT_FILE', __DIR__ . '/lico_export.json');
// ====================================================

header('Content-Type: text/plain; charset=utf-8');

if (!isset($_GET['key']) || !hash_equals(EXPORT_SECRET, $_GET['key'])) {
    http_response_code(403);
    echo "Forbidden\n";
    exit;
}

require_once __DIR__ . '/wp-load.php';

if (!function_exists('get_posts')) {
    http_response_code(500);
    echo "wp-load.php не загрузился. Проверьте, что файл лежит в корне WP.\n";
    exit;
}

echo "Exporting lichnosty.ru CPT 'lico'...\n";
$start = microtime(true);

// ---- Категории (lico_cat) ----
$terms = get_terms([
    'taxonomy'   => 'lico_cat',
    'hide_empty' => false
]);
$categories = [];
foreach ($terms as $t) {
    $categories[] = [
        'term_id'     => (int) $t->term_id,
        'slug'        => $t->slug,
        'name'        => $t->name,
        'description' => $t->description,
        'parent'      => (int) $t->parent,
        'count'       => (int) $t->count
    ];
}
echo "  categories: " . count($categories) . "\n";

// ---- Биографии (lico) ----
$statuses = INCLUDE_DRAFTS ? ['publish', 'draft', 'private', 'pending'] : ['publish'];

$posts = get_posts([
    'post_type'      => 'lico',
    'post_status'    => $statuses,
    'posts_per_page' => -1,
    'orderby'        => 'ID',
    'order'          => 'ASC'
]);

$persons = [];
foreach ($posts as $p) {
    $meta_raw = get_post_meta($p->ID);
    $meta = [];
    foreach ($meta_raw as $k => $v) {
        $meta[$k] = (is_array($v) && count($v) === 1) ? $v[0] : $v;
    }
    // Try to decode _elementor_data if present (it's JSON as string)
    if (!empty($meta['_elementor_data']) && is_string($meta['_elementor_data'])) {
        $dec = json_decode($meta['_elementor_data'], true);
        if ($dec !== null) $meta['_elementor_data_parsed'] = $dec;
    }

    $terms_post = wp_get_post_terms($p->ID, 'lico_cat', ['fields' => 'all']);
    $term_slugs = array_map(function ($t) { return $t->slug; }, $terms_post);

    $thumb_id  = get_post_thumbnail_id($p->ID);
    $thumb_url = $thumb_id ? wp_get_attachment_url($thumb_id) : null;

    // All attachments linked to this post
    $attachments = get_attached_media('', $p->ID);
    $att_list = [];
    foreach ($attachments as $a) {
        $att_list[] = [
            'id'       => (int) $a->ID,
            'url'      => wp_get_attachment_url($a->ID),
            'mime'     => $a->post_mime_type,
            'alt'      => get_post_meta($a->ID, '_wp_attachment_image_alt', true)
        ];
    }

    $persons[] = [
        'id'           => (int) $p->ID,
        'slug'         => $p->post_name,
        'title'        => $p->post_title,
        'content'      => $p->post_content,
        'excerpt'      => $p->post_excerpt,
        'status'       => $p->post_status,
        'date'         => $p->post_date_gmt,
        'modified'     => $p->post_modified_gmt,
        'author_id'    => (int) $p->post_author,
        'guid'         => $p->guid,
        'categories'   => $term_slugs,
        'meta'         => $meta,
        'thumbnail'    => $thumb_url,
        'thumbnail_id' => $thumb_id ? (int) $thumb_id : null,
        'attachments'  => $att_list
    ];
}
echo "  persons: " . count($persons) . "\n";

// ---- Листинг uploads/ ----
$uploads = [];
if (INCLUDE_UPLOADS_INDEX) {
    $upload_dir = wp_upload_dir();
    $basedir    = $upload_dir['basedir'];
    $baseurl    = $upload_dir['baseurl'];

    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($basedir, RecursiveDirectoryIterator::SKIP_DOTS));
    foreach ($it as $file) {
        if (!$file->isFile()) continue;
        $rel = ltrim(str_replace($basedir, '', $file->getPathname()), DIRECTORY_SEPARATOR);
        $uploads[] = [
            'path' => str_replace('\\', '/', $rel),
            'size' => $file->getSize(),
            'url'  => $baseurl . '/' . str_replace('\\', '/', $rel)
        ];
    }
    echo "  uploads index: " . count($uploads) . " files\n";
}

$out = [
    'site'       => home_url(),
    'exported'   => gmdate('c'),
    'wp_version' => get_bloginfo('version'),
    'categories' => $categories,
    'persons'    => $persons,
    'uploads'    => $uploads
];

$json = json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false) {
    echo "json_encode failed: " . json_last_error_msg() . "\n";
    exit;
}

file_put_contents(OUTPUT_FILE, $json);
$elapsed = round(microtime(true) - $start, 2);

echo "\nOK. Wrote " . OUTPUT_FILE . " (" . number_format(strlen($json)) . " bytes) in {$elapsed}s\n";
echo "\nNow download lico_export.json and DELETE this script from the server.\n";

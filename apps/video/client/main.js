// Video department frontend — jQuery.
import $ from 'jquery';
import './legacy.css';
import { addToCart } from '@northridge/shared/cart.js';
import { mountCartBadge } from '@northridge/shared/cart-ui.js';

mountCartBadge();

function priceUSD(cents) {
  return '$' + (cents / 100).toFixed(2);
}

// Keep the loaded page's items around so Add-to-cart can look them up.
let currentItems = [];

function renderPager(page, totalPages) {
  if (totalPages <= 1) return '';
  let html = '<ul class="pagination-legacy">';
  html +=
    '<li class="' +
    (page === 1 ? 'disabled' : '') +
    '"><a href="#" data-page="' +
    (page - 1) +
    '">&laquo; Prev</a></li>';
  for (let p = 1; p <= totalPages; p++) {
    html +=
      '<li class="' +
      (p === page ? 'active' : '') +
      '"><a href="#" data-page="' +
      p +
      '">' +
      p +
      '</a></li>';
  }
  html +=
    '<li class="' +
    (page === totalPages ? 'disabled' : '') +
    '"><a href="#" data-page="' +
    (page + 1) +
    '">Next &raquo;</a></li>';
  html += '</ul>';
  return html;
}

async function loadCatalog(page) {
  const res = await fetch('/video/api/products?page=' + (page || 1));
  if (!res.ok) throw new Error('Failed to load catalog: ' + res.status);
  const data = await res.json();
  currentItems = data.items;

  const rows = data.items
    .map(function (item) {
      const meta = item.starring
        ? item.format + ' \u00b7 ' + item.starring
        : item.format + (item.genre ? ' \u00b7 ' + item.genre : '');
      return (
        '<div class="list-item-legacy" data-sku="' + item.sku + '">' +
        '<div>' +
        '<div class="li-title"><a class="detail-link-legacy" href="/video/' +
        item.sku +
        '">' + item.title + '</a></div>' +
        '<div class="li-meta">' + meta + '</div>' +
        '</div>' +
        '<div class="li-actions">' +
        '<span class="li-price">' + priceUSD(item.price_cents) + '</span> ' +
        '<button class="btn-legacy add" type="button">Add to cart</button>' +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  const $app = $('#app');
  $app.html(
    '<h1 class="legacy-h1">Video</h1>' +
      '<p>DVDs, VHS, players and TVs. <span class="text-muted-legacy">(' +
      data.total +
      ' items)</span></p>' +
      '<div class="panel-legacy">' +
      '<div class="panel-heading-legacy">Video Catalog</div>' +
      '<div class="list-legacy">' + rows + '</div>' +
      '</div>' +
      renderPager(data.page, data.totalPages),
  );
}

const $app = $('#app');

// Add-to-cart (delegated).
$app.on('click', 'button.add', function () {
  const sku = $(this).closest('.list-item-legacy').data('sku');
  const item = currentItems.find(function (i) {
    return i.sku === sku;
  });
  if (item) {
    addToCart({
      sku: item.sku,
      title: item.title,
      price_cents: item.price_cents,
    });
  }
});

// Pager (delegated).
$app.on('click', '.pagination-legacy a', function (e) {
  e.preventDefault();
  const $li = $(this).parent();
  if ($li.hasClass('disabled') || $li.hasClass('active')) return;
  const page = parseInt($(this).attr('data-page'), 10);
  window.scrollTo(0, 0);
  loadCatalog(page).catch(function (err) {
    $app.text(String(err));
  });
});

// Detail add-to-cart (delegated; button carries its own data).
$app.on('click', 'button.detail-add', function () {
  const $btn = $(this);
  addToCart({
    sku: $btn.attr('data-sku'),
    title: $btn.attr('data-title'),
    price_cents: parseInt($btn.attr('data-price'), 10),
  });
});

function detailRow(label, value) {
  if (!value) return '';
  return (
    '<div class="detail-row-legacy"><span class="detail-label-legacy">' +
    label +
    '</span><span>' +
    value +
    '</span></div>'
  );
}

async function loadDetail(sku) {
  const res = await fetch('/video/api/products/' + encodeURIComponent(sku));
  if (res.status === 404) {
    $app.html(
      '<div class="alert-legacy" style="display:block">That item could not be found. ' +
        '<a href="/video/">Back to Video</a>.</div>',
    );
    return;
  }
  if (!res.ok) throw new Error('Failed to load: ' + res.status);
  const item = await res.json();

  $app.html(
    '<p><a href="/video/">&laquo; Back to Video</a></p>' +
      '<div class="panel-legacy">' +
      '<div class="panel-heading-legacy">' + item.title + '</div>' +
      '<div class="panel-body-legacy">' +
      (item.description ? '<p>' + item.description + '</p>' : '') +
      detailRow('Starring', item.starring) +
      detailRow('Director', item.director) +
      detailRow('Studio', item.studio) +
      detailRow('Genre', item.genre) +
      detailRow('Format', item.format) +
      detailRow('Released', item.release_date) +
      detailRow('SKU', item.sku) +
      '<div class="detail-buy-legacy">' +
      '<span class="li-price">' + priceUSD(item.price_cents) + '</span> ' +
      '<button class="btn-legacy detail-add" type="button" data-sku="' +
      item.sku +
      '" data-title="' + item.title.replace(/"/g, '&quot;') + '" data-price="' +
      item.price_cents +
      '">Add to cart</button>' +
      '</div>' +
      '</div>' +
      '</div>',
  );
}

// Route on the path: /video/<SKU> shows a detail page, otherwise the catalog.
function route() {
  const m = window.location.pathname.match(/^\/video\/(VID-[^/]+)\/?$/);
  const work = m ? loadDetail(m[1]) : loadCatalog(1);
  work.catch(function (err) {
    $app.text(String(err));
  });
}

route();




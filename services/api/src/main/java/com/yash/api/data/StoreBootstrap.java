package com.yash.api.data;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.yash.api.security.AuthService;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

@Component
public class StoreBootstrap {
    private final MongoTemplate mongo;
    private final AuthService auth;
    private volatile boolean initialized;

    public StoreBootstrap(MongoTemplate mongo, AuthService auth) {
        this.mongo = mongo;
        this.auth = auth;
    }

    public void ensureSeeded() {
        if (initialized) return;
        synchronized (this) {
            if (initialized) return;
            seedAdmin();
            seedSettings();
            seedCollections();
            seedProducts();
            initialized = true;
        }
    }

    private void seedAdmin() {
        MongoCollection<Document> users = mongo.getCollection("users");
        if (users.find(Filters.eq("email", "yashcoofficial@gmail.com")).first() != null) return;
        AuthService.PasswordHash password = auth.hashPassword("Admin@123");
        users.insertOne(new Document("id", UUID.randomUUID().toString())
                .append("email", "yashcoofficial@gmail.com")
                .append("name", "YASH Atelier")
                .append("role", "admin")
                .append("passwordSalt", password.salt())
                .append("passwordHash", password.hash())
                .append("createdAt", new Date()));
    }

    private void seedSettings() {
        MongoCollection<Document> settings = mongo.getCollection("settings");
        if (settings.find(Filters.eq("key", "site")).first() != null) return;
        settings.insertOne(new Document("key", "site")
                .append("brand", "YASH")
                .append("slogan", "Own Every Moment")
                .append("heroTitle", "Own Every Moment")
                .append("heroSubtitle", "A curated house of quiet luxury - tailored for the ones who define their own era.")
                .append("heroImage", "https://images.pexels.com/photos/31466152/pexels-photo-31466152.jpeg")
                .append("heroCtaLabel", "Discover the Collection")
                .append("announcement", "Complimentary global concierge shipping on orders above INR 50,000")
                .append("aboutTitle", "The House of YASH")
                .append("aboutBody", "Rooted in craftsmanship and cut for a global sensibility, YASH is a study in restraint.")
                .append("lookbookTitle", "Editorial Lookbook")
                .append("lookbookSubtitle", "Season 01 - Nocturne")
                .append("lookbookImages", List.of(
                        "https://images.pexels.com/photos/35596695/pexels-photo-35596695.jpeg",
                        "https://images.pexels.com/photos/28133643/pexels-photo-28133643.jpeg",
                        "https://images.pexels.com/photos/28557819/pexels-photo-28557819.jpeg"))
                .append("concierge", Map.of("title", "Private Concierge", "subtitle", "Bespoke enquiries, private appointments, and made-to-measure requests are received with discretion.", "email", "yashcoofficial@gmail.com", "phone", "+91 00000 00000"))
                .append("currency", "INR")
                .append("currencySymbol", "₹")
                .append("headerNavLinks", List.of(
                        Map.of("label", "Shop", "page", "shop", "collection", "", "visible", true),
                        Map.of("label", "Men", "page", "shop", "collection", "menswear", "visible", true),
                        Map.of("label", "Women", "page", "shop", "collection", "womenswear", "visible", true),
                        Map.of("label", "Accessories", "page", "shop", "collection", "accessories", "visible", true),
                        Map.of("label", "Concierge", "page", "concierge", "collection", "", "visible", true)))
                .append("socialLinks", List.of(Map.of("label", "Instagram", "url", "https://www.instagram.com/", "visible", true)))
                .append("updatedAt", new Date()));
    }

    private void seedCollections() {
        MongoCollection<Document> collections = mongo.getCollection("collections");
        if (mongo.getCollection("settings").find(Filters.eq("key", "collections-seeded")).first() != null) return;
        if (collections.countDocuments() == 0) {
            List<Document> required = List.of(
                    collection("Womenswear", "womenswear", "https://images.pexels.com/photos/35596695/pexels-photo-35596695.jpeg", "Softly tailored silhouettes for the modern woman.", 1, null),
                    collection("Menswear", "menswear", "https://images.pexels.com/photos/28133643/pexels-photo-28133643.jpeg", "Sharply cut suits, quiet knits, considered essentials.", 2, null),
                    collection("Accessories", "accessories", "https://images.pexels.com/photos/28557819/pexels-photo-28557819.jpeg", "Leather, silk, and metal - the finishing gestures.", 3, null),
                    collection("Shirts", "menswear-shirts", "", "Polished shirts for every considered occasion.", 1, "menswear"),
                    collection("Trousers", "menswear-trousers", "", "Tailored trousers with an easy, precise line.", 2, "menswear"),
                    collection("T-Shirts", "menswear-t-shirts", "", "Refined everyday jersey essentials.", 3, "menswear"),
                    collection("Men", "accessories-men", "", "Finishing pieces for the modern man.", 1, "accessories"),
                    collection("Women", "accessories-women", "", "Finishing pieces for the modern woman.", 2, "accessories"),
                    collection("Perfume", "perfume", "", "Signature fragrances from the House of YASH.", 4, null));
            collections.insertMany(required);
        }
        mongo.getCollection("settings").insertOne(new Document("key", "collections-seeded").append("initializedAt", new Date()));
    }

    private void seedProducts() {
        MongoCollection<Document> products = mongo.getCollection("products");
        if (products.countDocuments() > 0) return;
        List<ProductSeed> catalog = List.of(
                new ProductSeed("Nocturne Silk Slip Gown", "womenswear", 68000, "https://images.pexels.com/photos/1655841/pexels-photo-1655841.jpeg", "A liquid-silk floor-length gown, cut on the bias. Hand-rolled hems. Fully lined."),
                new ProductSeed("Onyx Wool Tuxedo", "menswear", 124000, "https://images.pexels.com/photos/32335610/pexels-photo-32335610.jpeg", "A single-button tuxedo in Italian wool with grosgrain silk lapel. Half-canvassed."),
                new ProductSeed("Ivory Cashmere Long Coat", "womenswear", 96000, "https://images.pexels.com/photos/17542178/pexels-photo-17542178.jpeg", "Pure cashmere long coat with hand-stitched edges. Notched lapel. Concealed placket."),
                new ProductSeed("Midnight Leather Trench", "womenswear", 138000, "https://images.pexels.com/photos/20591025/pexels-photo-20591025.jpeg", "Full-grain nappa trench, softly draped, with a self-belt and turn-back cuffs."),
                new ProductSeed("Ivory Poplin Blouse", "womenswear", 22000, "https://images.pexels.com/photos/31450745/pexels-photo-31450745.jpeg", "Crisp Italian cotton poplin. Mother-of-pearl buttons. French seams throughout."),
                new ProductSeed("Charcoal Cashmere Roll-Neck", "menswear", 34000, "https://images.pexels.com/photos/1453008/pexels-photo-1453008.jpeg", "Fully-fashioned Grade-A cashmere roll-neck in a soft, dry hand."),
                new ProductSeed("Noir Leather Tote", "accessories", 84000, "https://images.pexels.com/photos/37467312/pexels-photo-37467312.jpeg", "Vegetable-tanned leather tote with saddle-stitched handles. Suede-lined."),
                new ProductSeed("Silk Twill Foulard", "accessories", 12800, "https://images.pexels.com/photos/19729206/pexels-photo-19729206.jpeg", "90cm silk twill scarf with hand-rolled edges. Screen-printed in Como, Italy."),
                new ProductSeed("Sculpted Gold Timepiece", "accessories", 168000, "https://images.pexels.com/photos/6765639/pexels-photo-6765639.jpeg", "Automatic movement. Sapphire crystal. Solid case in brushed pale gold."),
                new ProductSeed("Obsidian Derby Shoe", "menswear", 58000, "https://images.pexels.com/photos/135620/pexels-photo-135620.jpeg", "Hand-lasted derby in polished box calf. Goodyear-welted leather soles."));
        Date now = new Date();
        for (int index = 0; index < catalog.size(); index++) {
            ProductSeed item = catalog.get(index);
            products.insertOne(new Document("id", UUID.randomUUID().toString())
                    .append("name", item.name())
                    .append("slug", item.name().toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", ""))
                    .append("description", item.description())
                    .append("collection", item.collection())
                    .append("price", item.price())
                    .append("salePrice", null)
                    .append("onSale", false)
                    .append("sku", "YSH-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase())
                    .append("stock", 12)
                    .append("images", List.of(item.image()))
                    .append("sizes", List.of("S", "M", "L", "XL"))
                    .append("colors", List.of("Noir", "Ivory", "Champagne"))
                    .append("material", "Sourced from premier European mills.")
                    .append("care", "Professional dry-clean only. Store on a padded hanger.")
                    .append("sizeGuide", "Please refer to your usual fit. For bespoke fit guidance, contact our concierge.")
                    .append("featured", index < 4)
                    .append("sortOrder", index)
                    .append("createdAt", now)
                    .append("lowStockThreshold", 3));
        }
    }

    private static Document collection(String name, String slug, String image, String description, int order, String parent) {
        return new Document("id", UUID.randomUUID().toString()).append("name", name).append("slug", slug)
                .append("image", image).append("description", description).append("order", order).append("parentSlug", parent);
    }

    private record ProductSeed(String name, String collection, int price, String image, String description) { }
}
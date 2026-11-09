import { SITE_URL } from '@/lib/seo'

const publicPages = {
	shop: {
		title: 'Shop Bespoke Fashion and Signature Pieces',
		description: 'Explore considered clothing and accessories from YASH, including made-to-measure styles for men and women.',
	},
	'shop/menswear': {
		title: 'Luxury Menswear and Tailored Clothing',
		description: 'Discover tailored menswear, considered essentials, and made-to-measure pieces from YASH.',
	},
	'shop/womenswear': {
		title: 'Luxury Womenswear and Tailored Clothing',
		description: 'Discover considered womenswear, refined silhouettes, and made-to-measure pieces from YASH.',
	},
	'shop/accessories': {
		title: 'Luxury Fashion Accessories',
		description: 'Explore the finishing pieces from YASH, including considered leather, silk, and accessories.',
	},
	perfume: {
		title: 'Signature Perfume',
		description: 'Discover signature fragrance from YASH, created as part of the House of YASH.',
	},
	concierge: {
		title: 'Private Concierge and Bespoke Enquiries',
		description: 'Contact the YASH concierge for bespoke enquiries, private appointments, and made-to-measure requests.',
	},
	about: {
		title: 'About the House of YASH',
		description: 'Learn about YASH and its considered approach to craftsmanship, tailoring, and modern luxury.',
	},
}

const privateRoutes = new Set(['admin', 'dashboard', 'cart', 'checkout', 'login', 'register', 'forgot', 'reset'])

export async function generateMetadata({ params }) {
	const { slug = [] } = await params
	const route = slug.join('/')
	const canonical = `/${slug.map(segment => encodeURIComponent(segment)).join('/')}`

	if (privateRoutes.has(slug[0])) {
		return {
			title: 'Private Account',
			alternates: { canonical },
			robots: { index: false, follow: false },
		}
	}

	const page = publicPages[route]
	if (page) {
		return {
			...page,
			alternates: { canonical },
			openGraph: { type: 'website', url: canonical, title: page.title, description: page.description },
		}
	}

	if ((slug[0] === 'product' || slug[0] === 'products') && slug[1]) {
		const title = 'Luxury Fashion and Bespoke Tailoring'
		const description = 'Explore considered fashion and made-to-measure pieces from YASH.'
		return {
			title,
			description,
			alternates: { canonical },
			openGraph: { type: 'website', url: canonical, title, description },
		}
	}

	if (slug[0] === 'policies') {
		const policyTitle = slug[1]?.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Policies'
		return {
			title: `${policyTitle} | YASH Policies`,
			description: `Read the YASH ${policyTitle.toLowerCase()} policy.`,
			alternates: { canonical },
		}
	}

	return {
		title: 'Page Not Found',
		alternates: { canonical: SITE_URL },
		robots: { index: false, follow: true },
	}
}

export { default } from '../page'

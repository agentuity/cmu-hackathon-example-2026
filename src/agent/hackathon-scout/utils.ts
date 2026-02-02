/**
 * Utility functions for Hackathon Scout Agent
 */

/**
 * Fetch papers from ArXiv API
 * ArXiv provides free access to research papers via a simple REST API
 */
export async function fetchArxiv(query: string, maxResults: number = 5): Promise<string> {
	const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${maxResults}&sortBy=relevance`;

	const response = await fetch(url);
	if (!response.ok) {
		return `Error: ArXiv API returned status ${response.status}`;
	}
	return response.text();
}

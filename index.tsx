/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import App from '@/App';
import {DataContext} from '@/context';
import React from 'react';
import ReactDOM from 'react-dom/client';
import {Example} from './lib/types';

function DataProvider({children}) {
  const [examples, setExamples] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setIsLoading(true);
    // Fetch from remote API endpoint (configured via env variable)
    let apiUrl = import.meta.env.VITE_EXAMPLES_API_URL || '/api/examples';
    
    // Safety check: Ensure we don't accidentally fetch from documentation URLs if env was misconfigured
    if (apiUrl.startsWith('http') && !apiUrl.includes(window.location.host)) {
      console.warn(`[Client] Blocking suspicious absolute API URL: ${apiUrl}. Falling back to local API.`);
      apiUrl = '/api/examples';
    }
    
    console.log(`[Client] Attempting to fetch examples from: ${apiUrl}`);
    
    fetch(apiUrl)
      .then((res) => {
        console.log(`[Client] Fetch response status: ${res.status}`);
        if (!res.ok) throw new Error(`API fetch failed with status ${res.status}`);
        return res.json();
      })
      .then((fetchedData) => {
        console.log(`[Client] Successfully received ${Array.isArray(fetchedData) ? fetchedData.length : 'some'} examples`);
        const data = Array.isArray(fetchedData) ? fetchedData : (fetchedData.data || []);
        setExamples(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('[Client] Error fetching remote examples:', err);
        console.error('[Client] Fetch URL was:', apiUrl);
        // Fallback to local data if remote fails
        const fallbackUrl = 'data/examples.json';
        console.log(`[Client] Attempting fallback to: ${fallbackUrl}`);
        fetch(fallbackUrl)
            .then(res => res.json())
            .then(fallbackData => {
              setExamples(fallbackData);
              setIsLoading(false);
            })
            .catch(fallbackErr => {
              console.error('[Client] Fallback also failed:', fallbackErr);
              setIsLoading(false);
            });
      });
  }, []);

  const empty = {title: '', url: '', spec: '', code: ''};

  const value = {
    examples,
    isLoading,
    setExamples,
    defaultExample: examples?.length > 0 ? examples[0] : empty,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <DataProvider>
    <App />
  </DataProvider>,
);

import {loadSharedMcpTestClientConfigFromEnv} from './env';
import {installSharedMcpTestClient} from './sharedClient';

installSharedMcpTestClient(loadSharedMcpTestClientConfigFromEnv());
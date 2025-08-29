import { Card, TextContainer, Text } from "@shopify/polaris";
import { useQuery } from "react-query";

export function ShopInfoCard() {
    const { data, isLoading, error } = useQuery({
        queryKey: ["shopInfo"],
        queryFn: async () => {
            const response = await fetch("/api/shop");
            return await response.json();
        },
        refetchOnWindowFocus: false,
    });

    return (
        <Card title="Shop Information" sectioned>
            <TextContainer spacing="loose">
                {isLoading && <p>Loading shop info...</p>}
                {error && <p>Error fetching shop info</p>}
                {data && (
                    <>
                        <Text as="h4" variant="headingMd">
                            🏪 {data.name}
                        </Text>
                        <p>Domain: {data.myshopify_domain}</p>
                        <p>Email: {data.email || data.contactEmail}</p>
                        <p>Plan: {data.plan_display_name}</p>

                        {data.billingAddress && (
                            <>
                                <p>Address 1: {data.billingAddress.address1}</p>
                                <p>Address 2: {data.billingAddress.address2}</p>
                                <p>City: {data.billingAddress.city}</p>
                                <p>Country: {data.billingAddress.country}</p>
                                <p>ZIP: {data.billingAddress.zip}</p>
                                <p>Phone: {data.billingAddress.phone}</p>
                            </>
                        )}
                    </>
                )}
            </TextContainer>
        </Card>
    );
}
